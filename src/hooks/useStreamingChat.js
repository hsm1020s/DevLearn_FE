/**
 * @fileoverview SSE 기반 스트리밍 채팅 커스텀 훅.
 * 메시지 전송, 토큰 단위 스트리밍 수신, 중단 처리, 스마트 오토스크롤을 관리한다.
 *
 * 단일 모드 동작:
 *   - useChatStore.currentConversationId 기준으로 메시지를 읽고 쓰는 기존 동작.
 *   - useStudyStore의 feynmanChapter가 설정되어 있으면 /api/feynman/stream 으로 라우팅.
 *   - 새 파인만 세션 진입 시 AI가 먼저 첫 질문을 자동 생성한다(useEffect 트리거).
 *
 * Split 모드 (학습 워크스페이스 좌우 분할):
 *   - options.paneKey ('left' | 'right') 가 주어지면 paneKey 별 대화 슬롯
 *     (splitConversationIds[mode][paneKey])을 사용해 currentConversationId를 우회한다.
 *   - 좌측(left)은 항상 일반 라우트, 우측(right)은 항상 파인만 라우트로 강제.
 *   - isStreaming은 좌·우 독립이 필요하므로 split일 때 store 대신 로컬 state를 사용.
 *   - 우측은 자동 첫 질문 트리거를 끄고 외부에서 startFeynmanSession()을 호출해야
 *     첫 질문이 시작된다.
 *
 * 스마트 오토스크롤:
 *   - 사용자가 하단 근접(임계 120px) 상태일 때만 새 토큰/메시지에 맞춰 자동 스크롤.
 *   - 위로 올려 이전 대화를 읽는 중이면 오토스크롤을 멈추고 `hasNewBelow` 플래그로
 *     "새 답변 도착"을 UI에 알림. 버튼 클릭 시 `scrollToBottomNow`로 복귀.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import useChatStore from '../stores/useChatStore';
import useAppStore from '../stores/useAppStore';
import useStudyStore from '../stores/useStudyStore';
import { streamMessage } from '../services/chatApi';
import { streamFeynmanChat } from '../services/feynmanApi';
import { showError } from '../utils/errorHandler';
import { isLearningMode } from '../registry/modes';
import { STYLE_PROMPT } from '../registry/stylePrompts';

// 하단 근접 판정 임계값(px). 이 거리 이내면 "맨 아래로 따라가기" 모드로 간주.
const NEAR_BOTTOM_THRESHOLD = 120;

/**
 * 스트리밍 채팅 훅
 * @param {string} mode - 채팅 모드 (general | study | worklearn)
 * @param {object} [options]
 * @param {'left'|'right'} [options.paneKey] - split 모드의 좌/우 식별자.
 *   주어지면 splitConversationIds[mode][paneKey] 슬롯을 활성 대화로 사용한다.
 *   left=일반 라우트 강제, right=파인만 라우트 강제.
 * @param {boolean} [options.autoStartFeynman] - 파인만 세션 자동 첫 질문 트리거 여부.
 *   기본값: split 환경(좌·우 모두)은 false, 단일 모드는 true.
 *   split 좌측은 일반 채팅 전용이라 파인만 챕터 변경에 반응하면 안 되고,
 *   우측은 명시적 [▶ 시작] 버튼이 startFeynmanSession()을 호출하므로 자동 트리거가 불필요.
 */
export default function useStreamingChat(mode, options = {}) {
  const { paneKey } = options;
  const isSplit = paneKey === 'left' || paneKey === 'right';
  const autoStartFeynman = options.autoStartFeynman ?? !isSplit;

  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const splitConvId = useChatStore((s) =>
    isSplit ? (s.splitConversationIds[mode]?.[paneKey] ?? null) : null,
  );
  const effectiveConvId = isSplit ? splitConvId : currentConversationId;

  const conversations = useChatStore((s) => s.conversations);
  const currentConvMessages = useMemo(() => {
    const conv = conversations.find((c) => c.id === effectiveConvId);
    return conv?.messages || [];
  }, [conversations, effectiveConvId]);

  // isStreaming은 split일 때 좌·우가 독립적으로 스트리밍 가능해야 하므로 로컬 state로 관리.
  const storeIsStreaming = useChatStore((s) => s.isStreaming);
  const setStoreStreaming = useChatStore((s) => s.setStreaming);
  const [localStreaming, setLocalStreaming] = useState(false);
  const isStreaming = isSplit ? localStreaming : storeIsStreaming;
  const setStreaming = useCallback(
    (v) => (isSplit ? setLocalStreaming(v) : setStoreStreaming(v)),
    [isSplit, setStoreStreaming],
  );

  const addMessage = useChatStore((s) => s.addMessage);
  const addMessageTo = useChatStore((s) => s.addMessageTo);
  const createConversation = useChatStore((s) => s.createConversation);
  const createSplitConversation = useChatStore((s) => s.createSplitConversation);
  const selectedLLM = useAppStore((s) => s.selectedLLM);

  // split일 때 메시지를 어디에 넣을지: 명시적 convId가 있으면 그쪽, 없으면 effectiveConvId.
  const pushMessage = useCallback(
    (message, convIdOverride) => {
      if (isSplit) {
        return addMessageTo(convIdOverride ?? effectiveConvId, message);
      }
      return addMessage(message);
    },
    [isSplit, addMessage, addMessageTo, effectiveConvId],
  );

  const ensureConversation = useCallback(() => {
    if (effectiveConvId) return effectiveConvId;
    if (isSplit) return createSplitConversation(mode, selectedLLM, paneKey);
    return createConversation(mode, selectedLLM);
  }, [effectiveConvId, isSplit, createSplitConversation, createConversation, mode, selectedLLM, paneKey]);

  const newConversation = useCallback(() => {
    if (isSplit) return createSplitConversation(mode, selectedLLM, paneKey);
    return createConversation(mode, selectedLLM);
  }, [isSplit, createSplitConversation, createConversation, mode, selectedLLM, paneKey]);

  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 파인만 초기 질문 트리거 방지용 — 대화가 이미 시작된 경우 재트리거 방지
  const feynmanInitRef = useRef(false);

  // 하단 근접 여부. ref는 effect/콜백에서 즉시 참조, state는 UI(버튼 노출)용.
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 위로 올려둔 상태에서 새 답변이 도착했는지 — 플로팅 버튼 뱃지에 사용.
  const [hasNewBelow, setHasNewBelow] = useState(false);

  // 강제로 맨 아래로 스크롤. 버튼 클릭·사용자 전송 직후 사용.
  const scrollToBottomNow = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    setHasNewBelow(false);
  }, []);

  // 스크롤 이벤트 핸들러. 컨테이너의 onScroll에 연결한다.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < NEAR_BOTTOM_THRESHOLD;
    if (isAtBottomRef.current !== near) {
      isAtBottomRef.current = near;
      setIsAtBottom(near);
    }
    // 사용자가 손으로 맨 아래 근접까지 돌아오면 "새 답변" 뱃지도 해제.
    if (near) setHasNewBelow(false);
  }, []);

  // 메시지 목록/스트리밍 상태 변경 시: 근접이면 자동 스크롤, 아니면 새 답변 플래그.
  useEffect(() => {
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    } else if (currentConvMessages.length > 0 || isStreaming) {
      setHasNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConvMessages.length, isStreaming]);

  // 스트리밍 토큰이 들어올 때마다 — 근접 상태에서만 따라붙기. 위에 있으면 무시(뱃지는 이미 켜짐).
  useEffect(() => {
    if (!streamingContent) return;
    if (!isAtBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [streamingContent]);

  // 대화가 바뀌면 자동으로 맨 아래로 + 상태 초기화.
  useEffect(() => {
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    setHasNewBelow(false);
    feynmanInitRef.current = false;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [effectiveConvId]);

  // 파인만 스트리밍 요청 실행 헬퍼
  const doFeynmanStream = useCallback(
    async (content, convId, controller, feynmanDocId, feynmanChapter) => {
      await streamFeynmanChat({
        docId: feynmanDocId,
        chapter: feynmanChapter,
        message: content || '',
        conversationId: convId,
        llm: selectedLLM,
        signal: controller.signal,
        onToken: (accumulated) => {
          if (!controller.signal.aborted) setStreamingContent(accumulated);
        },
        onDone: (result) => {
          if (!controller.signal.aborted) {
            pushMessage(
              {
                role: 'assistant',
                content: result.content,
                sources: result.sources,
                meta: { style: 'feynman' },
              },
              convId,
            );
          }
          if (result?.conversationId) {
            useChatStore.getState().reconcileConversation(result.conversationId);
          }
          setStreamingContent('');
          setStreaming(false);
        },
      });
    },
    [selectedLLM, pushMessage, setStreaming],
  );

  // 일반 스트리밍 요청 실행 헬퍼 (409 재시도 로직에서 재사용)
  // style: 학습 모드에서 다음 턴에 적용할 스타일(general|feynman). 메시지 meta + 프리픽스에 사용.
  const doStream = useCallback(
    async (content, convId, controller, style) => {
      const prefixed = style && STYLE_PROMPT[style] ? STYLE_PROMPT[style] + content : content;
      await streamMessage({
        message: prefixed,
        mode,
        llm: selectedLLM,
        conversationId: convId,
        signal: controller.signal,
        onToken: (accumulated) => {
          if (!controller.signal.aborted) setStreamingContent(accumulated);
        },
        onDone: (result) => {
          if (!controller.signal.aborted) {
            pushMessage(
              {
                role: 'assistant',
                content: result.content,
                sources: result.sources,
                meta: style && style !== 'general' ? { style } : undefined,
              },
              convId,
            );
          }
          // 스트리밍 경로로도 서버에 대화가 생성되므로 isLocal 승격 + 대기 패치 flush
          if (result?.conversationId) {
            useChatStore.getState().reconcileConversation(result.conversationId);
          }
          setStreamingContent('');
          setStreaming(false);
        },
      });
    },
    [mode, selectedLLM, pushMessage, setStreaming],
  );

  // 파인만 세션 시작 시 AI 첫 질문 자동 트리거 (단일 모드 / split 좌측 비활성)
  // 파인만 세션은 모드별 슬롯에 보관 — 학습 모드(study/worklearn)일 때만 의미 있고,
  // 그 외 모드에서는 항상 비어있어 자동 트리거 useEffect의 가드(if !docId || !chapter)에서 걸러진다.
  const feynmanDocId = useStudyStore((s) => s.feynmanByMode?.[mode]?.docId ?? null);
  const feynmanChapter = useStudyStore((s) => s.feynmanByMode?.[mode]?.chapter ?? null);

  // 파인만 세션을 명시적으로 시작 (split 우측의 [▶ 시작] 버튼이 호출).
  // 챕터/문서가 store에 세팅된 직후 호출하면 새 대화를 만들고 AI 첫 질문을 트리거.
  const startFeynmanSession = useCallback(
    async (docId, chapter) => {
      const dId = docId ?? feynmanDocId;
      const cId = chapter ?? feynmanChapter;
      if (!dId || !cId) return;
      if (isStreaming) return;
      feynmanInitRef.current = true;

      const convId = newConversation();
      setStreaming(true);
      setStreamingContent('');
      scrollToBottomNow();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await doFeynmanStream('', convId, controller, dId, cId);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[useStreamingChat] Feynman manual start error:', err);
        showError(err, '파인만 학습 시작 실패');
        setStreamingContent('');
        setStreaming(false);
      }
    },
    [feynmanDocId, feynmanChapter, isStreaming, newConversation, setStreaming, scrollToBottomNow, doFeynmanStream],
  );

  useEffect(() => {
    if (!autoStartFeynman) return; // split 우측 등에서는 명시적 트리거만 허용
    if (!feynmanDocId || !feynmanChapter) {
      feynmanInitRef.current = false;
      return;
    }
    // 이미 초기화 완료 또는 스트리밍 중이면 재트리거 방지
    if (feynmanInitRef.current || isStreaming) return;
    feynmanInitRef.current = true;

    // 항상 새 대화를 만들어 파인만 세션 시작 — 기존 대화가 있어도 새 대화로 전환
    (async () => {
      const convId = newConversation();
      setStreaming(true);
      setStreamingContent('');
      scrollToBottomNow();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await doFeynmanStream('', convId, controller, feynmanDocId, feynmanChapter);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[useStreamingChat] Feynman init error:', err);
        showError(err, '파인만 학습 시작 실패');
        setStreamingContent('');
        setStreaming(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feynmanDocId, feynmanChapter, autoStartFeynman]);

  // 사용자 메시지 전송 및 SSE 스트리밍 수신 처리
  const handleSend = useCallback(
    async (content) => {
      const studyState = useStudyStore.getState();
      const { docId: fDocId, chapter: fChapter } = studyState.getFeynmanSession(mode);

      // 라우팅 결정:
      // - split left: 항상 일반 라우트 (style='general' 강제)
      // - split right: 항상 파인만 라우트 (챕터 없으면 send 자체 무시)
      // - 단일 모드: 기존 동작 (학습 모드면 chatStyle/feynmanChapter에 따라 분기)
      const forcedFeynman = isSplit && paneKey === 'right';
      const forcedGeneral = isSplit && paneKey === 'left';
      const useFeynman = forcedFeynman || (!forcedGeneral && fDocId && fChapter);

      if (forcedFeynman && (!fDocId || !fChapter)) return; // 챕터 미선택 — 무시

      if (useFeynman) {
        const convId = ensureConversation();
        pushMessage(
          { role: 'user', content, meta: { style: 'feynman' } },
          convId,
        );
        setStreaming(true);
        setStreamingContent('');
        scrollToBottomNow();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await doFeynmanStream(content, convId, controller, fDocId, fChapter);
        } catch (err) {
          if (err.name === 'AbortError') return;
          if (err.status === 409) {
            console.warn('[useStreamingChat] 409 Conflict on feynman, 새 대화로 재시도');
            if (!isSplit) {
              const { deleteConversations: removeConvs } = useChatStore.getState();
              removeConvs([convId]);
            }
            const newConvId = newConversation();
            pushMessage(
              { role: 'user', content, meta: { style: 'feynman' } },
              newConvId,
            );
            try {
              await doFeynmanStream(content, newConvId, controller, fDocId, fChapter);
              return;
            } catch (retryErr) {
              if (retryErr.name === 'AbortError') return;
              showError(retryErr, '파인만 재시도 실패');
            }
          } else {
            showError(err, '파인만 응답 받기 실패');
          }
          setStreamingContent('');
          setStreaming(false);
        }
        return; // 파인만 모드에서는 스타일 리셋 불필요 (고정됨)
      }

      // 일반/파인만 스타일 칩(study 모드) — 기존 흐름
      // split left는 항상 'general'로 강제, 그 외 학습 모드는 chatStyle 사용
      const style = forcedGeneral
        ? 'general'
        : isLearningMode(mode)
          ? studyState.chatStyle
          : 'general';

      const convId = ensureConversation();
      pushMessage(
        {
          role: 'user',
          content,
          meta: !forcedGeneral && isLearningMode(mode) && style !== 'general' ? { style } : undefined,
        },
        convId,
      );
      setStreaming(true);
      setStreamingContent('');
      scrollToBottomNow();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await doStream(content, convId, controller, style);
      } catch (err) {
        if (err.name === 'AbortError') return;

        // 409 Conflict — 로컬 대화 ID가 서버에 없거나 충돌. 대화를 새로 만들어 재시도
        if (err.status === 409) {
          console.warn('[useStreamingChat] 409 Conflict, 새 대화로 재시도');
          if (!isSplit) {
            const { deleteConversations: removeConvs } = useChatStore.getState();
            removeConvs([convId]);
          }
          const newConvId = newConversation();
          pushMessage(
            {
              role: 'user',
              content,
              meta: !forcedGeneral && isLearningMode(mode) && style !== 'general' ? { style } : undefined,
            },
            newConvId,
          );
          try {
            await doStream(content, newConvId, controller, style);
            return;
          } catch (retryErr) {
            if (retryErr.name === 'AbortError') return;
            console.error('[useStreamingChat] Retry failed:', retryErr);
            showError(retryErr, 'AI 응답 재시도 실패');
          }
        } else {
          console.error('[useStreamingChat] Stream error:', err);
          showError(err, 'AI 응답 받기 실패');
        }
        setStreamingContent('');
        setStreaming(false);
      } finally {
        // 턴 종료 — split이 아닌 단일 학습 모드에서만 칩 자동 리셋(고정 미사용 시 'general'로)
        if (!isSplit && isLearningMode(mode)) {
          useStudyStore.getState().resetChatStyleIfNotLocked();
        }
      }
    },
    [isSplit, paneKey, mode, ensureConversation, newConversation, pushMessage, setStreaming, scrollToBottomNow, doStream, doFeynmanStream],
  );

  // 스트리밍 중단: SSE 연결을 끊고 현재까지 수신된 내용을 메시지로 확정
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingContent) {
      pushMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, pushMessage, setStreaming]);

  return {
    messages: currentConvMessages,
    streamingContent,
    isStreaming,
    handleSend,
    handleStop,
    scrollRef,
    handleScroll,
    isAtBottom,
    hasNewBelow,
    scrollToBottomNow,
    startFeynmanSession,
  };
}
