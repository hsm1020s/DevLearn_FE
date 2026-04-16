/**
 * @fileoverview 일반 모드 채팅 컨테이너 컴포넌트
 * 대화가 없을 때는 EmptyChatView로 중앙 레이아웃,
 * 대화 시작 후 입력창이 하단으로 이동한다.
 */
import { MessageSquare } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import EmptyChatView from './EmptyChatView';

const EXAMPLE_QUESTIONS = [
  'React와 Vue의 차이점은?',
  '정보처리기사 실기 팁 알려줘',
  '사내 휴가 규정 알려줘',
];

/** 일반 모드 채팅 화면 */
export default function ChatContainer() {
  const mainMode = useAppStore((s) => s.mainMode);
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat(mainMode);

  const isEmpty = messages.length === 0 && !streamingContent;

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full">
        <EmptyChatView
          icon={MessageSquare}
          title="일반 모드"
          description="무엇이든 물어보세요"
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 md:px-4 py-4 md:py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-3 md:gap-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingContent && (
            <ChatMessage
              message={{ id: '__streaming', role: 'assistant', content: streamingContent }}
              isStreaming
            />
          )}
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
      </div>
    </div>
  );
}
