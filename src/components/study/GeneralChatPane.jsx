/**
 * @fileoverview Split 학습 워크스페이스의 좌측 — 일반 채팅 패널.
 *
 * useStreamingChat을 paneKey='left'로 호출해 splitConversationIds[mode].left 슬롯을
 * 활성 대화로 사용한다. 좌측은 항상 일반(style='general') 라우트로 강제되므로,
 * 우측 파인만 패널이 어떤 상태든 좌측의 일반 대화는 영향을 받지 않는다.
 */
import { Sparkles } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import JumpToBottomButton from '../chat/JumpToBottomButton';

/**
 * @param {object} props
 * @param {'study'|'worklearn'} props.mode - 학습 계열 모드 식별자.
 */
export default function GeneralChatPane({ mode }) {
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
  } = useStreamingChat(mode, { paneKey: 'left' });

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 — 칩 바 위치에 표시 라벨 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light bg-bg-primary shrink-0">
        <Sparkles size={14} className="text-primary" />
        <span className="text-xs font-medium text-text-primary">일반 채팅</span>
        <span className="text-xs text-text-tertiary">· 자유 질의응답</span>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4 overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={22} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">무엇을 도와드릴까요?</h2>
            <p className="text-xs text-text-secondary">자유롭게 질문을 입력해보세요</p>
          </div>
          <div className="w-full max-w-2xl">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
