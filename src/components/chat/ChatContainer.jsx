/**
 * @fileoverview 채팅 컨테이너 컴포넌트
 * 메시지 목록, 스트리밍 응답, 입력창을 통합 관리하며,
 * 대화가 없을 때 환영 메시지와 예시 질문을 표시한다.
 */
import { MessageSquare } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useStreamingChat from '../../hooks/useStreamingChat';
import { MAIN_MODES } from '../../utils/constants';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

const EXAMPLE_QUESTIONS = [
  'React와 Vue의 차이점은?',
  '정보처리기사 실기 팁 알려줘',
  '사내 휴가 규정 알려줘',
];

/** 채팅 화면의 최상위 레이아웃 컴포넌트. 메시지 영역과 입력 영역으로 구성된다. */
export default function ChatContainer() {
  const mainMode = useAppStore((s) => s.mainMode);
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat(mainMode);

  const modeLabel = MAIN_MODES.find((m) => m.value === mainMode)?.label ?? '일반검색';
  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <WelcomeView modeLabel={modeLabel} onSelect={handleSend} />
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
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
        )}
      </div>

      {/* 입력 영역 */}
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}

/** 대화가 비어있을 때 표시되는 환영 화면. 예시 질문 클릭 시 바로 전송된다. */
function WelcomeView({ modeLabel, onSelect }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 max-w-lg mx-auto text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <MessageSquare size={24} className="text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {modeLabel} 모드
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          무엇이든 물어보세요. 아래 예시를 클릭해도 좋습니다.
        </p>
      </div>
      <div className="grid gap-2 w-full">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="
              text-left px-4 py-3 rounded-xl
              bg-bg-secondary border border-border-light
              text-sm text-text-primary
              hover:bg-bg-tertiary transition-colors
            "
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
