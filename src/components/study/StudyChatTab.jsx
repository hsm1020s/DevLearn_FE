/**
 * @fileoverview 학습 워크스페이스 — 채팅 탭.
 * 기존 StudyMode 채팅 본문을 이 탭 컨테이너로 옮기고, 상단에 StudyStyleChips를 얹는다.
 * 빈 상태에서는 StudyHomeCards(3카드 런처)를 중앙에 노출.
 */
import { FileText } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import JumpToBottomButton from '../chat/JumpToBottomButton';
import StudyStyleChips from './StudyStyleChips';
import StudyHomeCards from './StudyHomeCards';
import { useActiveSubjectMeta } from '../../hooks/useActiveSubject';

/** 학습 채팅 탭 — 스타일 칩 + 채팅 본문 + 빈 상태 런처. 예시 질문은 활성 과목별로 달라진다. */
export default function StudyChatTab() {
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
  } = useStreamingChat('study');

  const subjectMeta = useActiveSubjectMeta();
  const exampleQuestions = subjectMeta.examples || [];

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full">
      <StudyStyleChips />

      {isEmpty ? (
        // 빈 상태 — 중앙에 아이콘, 3카드, 예시 질문, 입력창
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText size={22} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">학습 · {subjectMeta.label}</h2>
            <p className="text-sm text-text-secondary">{subjectMeta.description}</p>
          </div>

          <StudyHomeCards />

          <div className="w-full max-w-2xl">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {exampleQuestions.map((q) => (
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
          <div className="max-w-3xl mx-auto w-full">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>
        </>
      )}
    </div>
  );
}
