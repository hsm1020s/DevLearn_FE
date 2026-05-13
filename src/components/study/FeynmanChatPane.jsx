/**
 * @fileoverview Split 학습 워크스페이스의 우측 — 파인만 채팅 패널.
 *
 * 두 개의 시각적 상태를 가진다:
 *   1. 시작 전 (idle):   챕터 선택 + [▶ 파인만 시작] 버튼. 입력창은 비활성.
 *      파인만 모드는 진입 즉시 AI 첫 질문이 자동 트리거되므로(`useStreamingChat`의
 *      파인만 useEffect), 사용자가 의도하지 않은 시점에 토큰 비용이 발생하지 않도록
 *      이 패널은 `autoStartFeynman: false`로 훅을 호출해 자동 트리거를 끈다.
 *   2. 진행 중 (active): 채팅 메시지 + 입력창 + 헤더에 챕터/[✕ 종료] 버튼.
 *
 * [✕ 종료] 클릭 시:
 *   - feynman 세션을 store에서 해제(clearFeynmanSession)
 *   - 우측 split 슬롯의 conv id도 비워(clearSplitConversation) 시작 전 화면으로 복귀
 *   - 좌측 일반 채팅에는 영향 없음
 */
import { useState, useCallback } from 'react';
import { Brain, Play, X, FileText } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import useStudyStore from '../../stores/useStudyStore';
import useChatStore from '../../stores/useChatStore';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import JumpToBottomButton from '../chat/JumpToBottomButton';
import FeynmanChapterPicker from '../feynman/FeynmanChapterPicker';

/**
 * @param {object} props
 * @param {'study'|'worklearn'} props.mode
 */
export default function FeynmanChatPane({ mode }) {
  // 파인만 세션은 모드별로 분리 — 공부와 업무학습이 서로의 챕터 선택을 침범하지 않음
  const feynmanDocId = useStudyStore((s) => s.feynmanByMode[mode]?.docId ?? null);
  const feynmanChapter = useStudyStore((s) => s.feynmanByMode[mode]?.chapter ?? null);
  const setFeynmanSession = useStudyStore((s) => s.setFeynmanSession);
  const clearFeynmanSession = useStudyStore((s) => s.clearFeynmanSession);
  const setChatStyle = useStudyStore((s) => s.setChatStyle);
  const setChatStyleLocked = useStudyStore((s) => s.setChatStyleLocked);
  const clearSplitConversation = useChatStore((s) => s.clearSplitConversation);

  // 우측 split 슬롯에 활성 conv가 있으면 진행 중으로 본다.
  // 챕터만 있고 conv가 없는 상태(시작 직전)는 여전히 idle로 노출되어 [▶ 시작] 버튼이 보임.
  const splitConvId = useChatStore((s) => s.splitConversationIds[mode]?.right ?? null);
  const sessionActive = !!feynmanChapter && !!splitConvId;

  const {
    messages,
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
  } = useStreamingChat(mode, { paneKey: 'right', autoStartFeynman: false });

  const [showChapterPicker, setShowChapterPicker] = useState(false);

  const handleChapterSelect = useCallback(
    (docId, chapter) => {
      setFeynmanSession(mode, docId, chapter);
      setChatStyle('feynman');
      setChatStyleLocked(true);
      setShowChapterPicker(false);
    },
    [mode, setFeynmanSession, setChatStyle, setChatStyleLocked],
  );

  const handleStart = useCallback(() => {
    if (!feynmanDocId || !feynmanChapter || isStreaming) return;
    startFeynmanSession(feynmanDocId, feynmanChapter);
  }, [feynmanDocId, feynmanChapter, isStreaming, startFeynmanSession]);

  const handleStopSession = useCallback(() => {
    // 스트리밍 중단도 같이 — 엔진 호출이 진행 중이면 깔끔히 끊는다
    if (isStreaming) handleStop();
    clearFeynmanSession(mode);
    clearSplitConversation(mode, 'right');
  }, [isStreaming, handleStop, clearFeynmanSession, clearSplitConversation, mode]);

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="relative flex items-center gap-2 px-4 py-2 border-b border-border-light bg-bg-primary shrink-0">
        <Brain size={14} className="text-primary" />
        <span className="text-xs font-medium text-text-primary">파인만 채팅</span>
        {sessionActive ? (
          <>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-xs text-text-secondary truncate flex-1" title={feynmanChapter}>
              {feynmanChapter}
            </span>
            <button
              onClick={handleStopSession}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md
                text-xs text-text-secondary hover:text-danger hover:bg-danger/5
                transition-colors"
              title="파인만 세션 종료"
            >
              <X size={12} />
              종료
            </button>
          </>
        ) : (
          <span className="text-xs text-text-tertiary">· 챕터 단위 대화형 점검</span>
        )}
      </div>

      {sessionActive ? (
        // ── 진행 중 상태 ──
        <>
          <div className="flex-1 relative min-h-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto px-4 py-6"
            >
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isStreaming && !streamingContent && <ChatLoadingBubble />}
                {isStreaming && streamingContent && (
                  <ChatMessage
                    message={{ id: '__streaming', role: 'assistant', content: streamingContent }}
                    isStreaming
                  />
                )}
              </div>
            </div>
            <JumpToBottomButton
              visible={!isAtBottom}
              hasNew={hasNewBelow}
              onClick={scrollToBottomNow}
            />
          </div>
          <div className="max-w-3xl mx-auto w-full px-4 pb-4">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>
        </>
      ) : (
        // ── 시작 전 상태 ──
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 overflow-y-auto relative">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain size={22} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">파인만 학습</h2>
            <p className="text-xs text-text-secondary text-center max-w-xs">
              챕터를 선택하고 시작 버튼을 누르면<br />
              AI가 첫 질문을 던집니다.
            </p>
          </div>

          <div className="w-full max-w-sm flex flex-col gap-3">
            {/* 챕터 선택 트리거 */}
            <div className="relative">
              <button
                onClick={() => setShowChapterPicker((v) => !v)}
                className={`
                  w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg
                  border text-sm transition-colors
                  ${feynmanChapter
                    ? 'bg-primary/5 border-primary/40 text-text-primary'
                    : 'bg-bg-primary border-border-light text-text-secondary hover:border-primary/40'}
                `}
              >
                <FileText size={14} className="text-primary shrink-0" />
                <span className="flex-1 text-left truncate">
                  {feynmanChapter || '챕터 선택'}
                </span>
                <span className="text-xs text-text-tertiary shrink-0">
                  {showChapterPicker ? '▴' : '▾'}
                </span>
              </button>
              {showChapterPicker && (
                <FeynmanChapterPicker
                  onClose={() => setShowChapterPicker(false)}
                  onSelect={handleChapterSelect}
                />
              )}
            </div>

            {/* 시작 버튼 */}
            <button
              onClick={handleStart}
              disabled={!feynmanDocId || !feynmanChapter || isStreaming}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-primary text-white text-sm font-medium
                hover:bg-primary-hover transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              <Play size={14} />
              파인만 시작하기
            </button>

            <p className="text-[11px] text-text-tertiary text-center">
              ⓘ 시작하면 AI가 자동으로 첫 질문을 던집니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
