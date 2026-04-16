/**
 * @fileoverview 채팅 컨테이너 컴포넌트
 * 대화가 없을 때는 입력창이 화면 중앙에 위치하고,
 * 대화 시작 후 입력창이 하단으로 이동하는 클로드 스타일 레이아웃.
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

/** 채팅 화면의 최상위 레이아웃 컴포넌트 */
export default function ChatContainer() {
  const mainMode = useAppStore((s) => s.mainMode);
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat(mainMode);

  const modeLabel = MAIN_MODES.find((m) => m.value === mainMode)?.label ?? '일반';
  const isEmpty = messages.length === 0 && !streamingContent;

  // 빈 상태 — 입력창이 화면 중앙에 위치
  if (isEmpty) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-4" style={{ marginTop: '-6%' }}>
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          {/* 환영 메시지 */}
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare size={24} className="text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-text-primary">
              {modeLabel} 모드
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              무엇이든 물어보세요
            </p>
          </div>

          {/* 중앙 입력창 */}
          <div className="w-full">
            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={handleStop}
            />
          </div>

          {/* 예시 질문 */}
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="px-3 py-2 rounded-lg bg-bg-secondary border border-border-light
                           text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 대화 진행 중 — 메시지 목록 + 하단 입력창
  return (
    <div className="flex flex-col h-full">
      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
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
      </div>

      {/* 하단 입력창 */}
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
