/**
 * @fileoverview SSE 기반 스트리밍 채팅 커스텀 훅.
 * 메시지 전송, 토큰 단위 스트리밍 수신, 중단 처리, 스마트 오토스크롤을 관리한다.
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
import { showError } from '../utils/errorHandler';
import { isLearningMode } from '../registry/modes';

// 학습 계열 모드(자격증 + 업무학습)의 스타일별 프리픽스.
// mock/백엔드가 이 토큰을 보고 응답 스타일을 결정한다. 일반 모드는 무시.
const STYLE_PREFIX = {
  feynman: '[파인만 모드] ',
  summary: '[한줄요약] ',
};

// 하단 근접 판정 임계값(px). 이 거리 이내면 "맨 아래로 따라가기" 모드로 간주.
const NEAR_BOTTOM_THRESHOLD = 120;

/**
 * 스트리밍 채팅 훅
 * @param {string} mode - 채팅 모드 (general | study)
 */
export default function useStreamingChat(mode) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const currentConvMessages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    return conv?.messages || [];
  }, [conversations, currentConversationId]);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const createConversation = useChatStore((s) => s.createConversation);
  const selectedLLM = useAppStore((s) => s.selectedLLM);

  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

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
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [currentConversationId]);

  // 스트리밍 요청 실행 헬퍼 (409 재시도 로직에서 재사용)
  // style: 학습 모드에서 다음 턴에 적용할 스타일(general|feynman|summary). 메시지 meta + 프리픽스에 사용.
  const doStream = useCallback(
    async (content, convId, controller, style) => {
      const prefixed = style && STYLE_PREFIX[style] ? STYLE_PREFIX[style] + content : content;
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
            addMessage({
              role: 'assistant',
              content: result.content,
              sources: result.sources,
              meta: style && style !== 'general' ? { style } : undefined,
            });
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
    [mode, selectedLLM, addMessage, setStreaming],
  );

  // 사용자 메시지 전송 및 SSE 스트리밍 수신 처리
  const handleSend = useCallback(
    async (content) => {
      // 학습 계열 모드(자격증·업무학습)에서만 현재 스타일을 읽어 프리픽스/메타에 사용.
      // 일반 모드는 무시 — 스타일 칩 자체가 학습 계열 UI에만 존재한다.
      const studyState = useStudyStore.getState();
      const style = isLearningMode(mode) ? studyState.chatStyle : 'general';

      // 대화가 없으면 새로 생성
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation(mode, selectedLLM);
      }
      addMessage({
        role: 'user',
        content,
        meta: isLearningMode(mode) && style !== 'general' ? { style } : undefined,
      });
      setStreaming(true);
      setStreamingContent('');
      // 사용자가 방금 전송했으니 무조건 맨 아래로 복귀.
      scrollToBottomNow();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await doStream(content, convId, controller, style);
      } catch (err) {
        if (err.name === 'AbortError') return; // 정상 중단

        // 409 Conflict — 로컬 대화 ID가 서버에 없거나 충돌. 대화를 새로 만들어 재시도
        if (err.status === 409) {
          console.warn('[useStreamingChat] 409 Conflict, 새 대화로 재시도');
          const { deleteConversations: removeConvs } = useChatStore.getState();
          removeConvs([convId]);
          const newConvId = createConversation(mode, selectedLLM);
          addMessage({ role: 'user', content });
          try {
            await doStream(content, newConvId, controller, style);
            return;
          } catch (retryErr) {
            if (retryErr.name === 'AbortError') return;
            console.error('[useStreamingChat] Retry failed:', retryErr);
            showError(retryErr);
          }
        } else {
          console.error('[useStreamingChat] Stream error:', err);
          showError(err);
        }
        setStreamingContent('');
        setStreaming(false);
      } finally {
        // 턴 종료 — 고정되지 않은 스타일은 'general'로 리셋
        if (isLearningMode(mode)) {
          useStudyStore.getState().resetChatStyleIfNotLocked();
        }
      }
    },
    [currentConversationId, createConversation, mode, selectedLLM, addMessage, setStreaming, doStream, scrollToBottomNow],
  );

  // 스트리밍 중단: SSE 연결을 끊고 현재까지 수신된 내용을 메시지로 확정
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingContent) {
      addMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, addMessage, setStreaming]);

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
  };
}
