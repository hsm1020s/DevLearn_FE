/**
 * @fileoverview 자격증 모드 — 채팅 기반 학습 화면.
 * EmptyChatView로 빈 상태를 공통 처리하고, 대화 시작 후 하단 입력창 레이아웃을 사용한다.
 */
import { FileText } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import EmptyChatView from '../chat/EmptyChatView';
import JumpToBottomButton from '../chat/JumpToBottomButton';

const EXAMPLE_QUESTIONS = [
  '정보처리기사 핵심 개념 알려줘',
  'OSI 7계층 설명해줘',
  'SQL 기본 문법 정리해줘',
];

/** 자격증 모드 채팅 화면 */
export default function CertMode() {
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
  } = useStreamingChat('cert');

  const isEmpty = messages.length === 0 && !streamingContent;

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full">
        <EmptyChatView
          icon={FileText}
          title="자격증 모드"
          description="자격증 학습에 대해 질문해보세요"
          examples={EXAMPLE_QUESTIONS}
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
      </div>
    </div>
  );
}
