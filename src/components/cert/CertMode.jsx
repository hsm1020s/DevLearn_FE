/**
 * @fileoverview 자격증 모드 — 채팅 기반 학습 화면.
 * EmptyChatView로 빈 상태를 공통 처리하고, 대화 시작 후 하단 입력창 레이아웃을 사용한다.
 */
import { FileText, BarChart3 } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import useAppStore from '../../stores/useAppStore';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import EmptyChatView from '../chat/EmptyChatView';

/** 상단 우측 "통계 보기" 트리거 — 누적 통계 모달(certStats)을 연다. */
function CertStatsTrigger() {
  return (
    <div className="flex justify-end px-4 pt-2">
      <button
        type="button"
        onClick={() => useAppStore.getState().setActiveModal('certStats')}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
        aria-label="학습 통계 보기"
      >
        <BarChart3 className="w-4 h-4" />
        <span className="hidden md:inline">통계 보기</span>
      </button>
    </div>
  );
}

const EXAMPLE_QUESTIONS = [
  '정보처리기사 핵심 개념 알려줘',
  'OSI 7계층 설명해줘',
  'SQL 기본 문법 정리해줘',
];

/** 자격증 모드 채팅 화면 */
export default function CertMode() {
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat('cert');

  const isEmpty = messages.length === 0 && !streamingContent;

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full">
        <CertStatsTrigger />
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
      <CertStatsTrigger />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
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
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
      </div>
    </div>
  );
}
