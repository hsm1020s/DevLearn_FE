/**
 * @fileoverview 업무학습 모드 — RAG 기반 문서 질의응답 채팅 화면.
 * EmptyChatView로 빈 상태를 공통 처리하고, 우측에 문서 패널을 배치한다.
 * 마운트 시 서버 문서 목록을 pull하고, 출처 카드 클릭 시 원문 모달을 연다.
 */
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import useDocStore from '../../stores/useDocStore';
import useAuthStore from '../../stores/useAuthStore';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import EmptyChatView from '../chat/EmptyChatView';
import JumpToBottomButton from '../chat/JumpToBottomButton';
import DocumentList from './DocumentList';
import SourcePanel from './SourcePanel';
import SourceChunkModal from './SourceChunkModal';

/** 업무학습 모드 예시 질문 */
const EXAMPLE_QUESTIONS = [
  '업로드한 문서 요약해줘',
  '이 문서의 핵심 내용은?',
  '관련 규정 찾아줘',
];

/** 업무학습 모드 메인 컴포넌트 */
export default function WorkStudyMode() {
  const docs = useDocStore((s) => s.docs);
  const fetchDocs = useDocStore((s) => s.fetchDocs);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
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
  } = useStreamingChat('work');

  // 마운트 시 서버에서 문서 목록 pull (processing 자동 폴링 포함)
  // 비로그인 상태에서 호출하면 401 → 전역 refresh 실패 → 강제 리로드로
  // 모드가 초기화되는 문제를 피하기 위해 로그인 시에만 호출한다.
  useEffect(() => {
    if (isLoggedIn) fetchDocs();
  }, [isLoggedIn, fetchDocs]);

  // 출처 카드 클릭으로 여는 원문 모달 상태
  const [selectedChunk, setSelectedChunk] = useState(null);

  const hasDocuments = docs.length > 0;
  const isEmpty = messages.length === 0 && !streamingContent;

  /* 빈 상태: 다른 모드와 동일한 단순 세로 flex 구조 (위치 통일) */
  if (isEmpty) {
    return (
      <div className="flex flex-col h-full">
        <EmptyChatView
          icon={BookOpen}
          title="업무학습 모드"
          description={hasDocuments
            ? '업로드된 문서를 기반으로 질문해보세요'
            : '사이드바에서 PDF를 업로드하고 질문해보세요'}
          examples={EXAMPLE_QUESTIONS}
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
        />
      </div>
    );
  }

  /* 대화 시작 후: 가로 flex로 문서 패널 포함 */
  return (
    <div className="flex h-full">
      {/* 좌측: 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto px-4 py-6"
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <ChatMessage message={msg} />
                  {msg.role === 'assistant' && msg.sources && (
                    <div className="ml-10 mt-1">
                      <SourcePanel
                        sources={msg.sources}
                        onSelectSource={setSelectedChunk}
                      />
                    </div>
                  )}
                </div>
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

      {/* 우측: 문서 패널 — 문서가 있을 때만 표시 */}
      {hasDocuments && (
        <div className="
          w-[240px] shrink-0
          border-l border-border-light bg-bg-primary
          hidden md:flex flex-col
        ">
          <DocumentList />
        </div>
      )}

      {/* 출처 원문 모달 */}
      <SourceChunkModal
        isOpen={!!selectedChunk}
        onClose={() => setSelectedChunk(null)}
        chunkId={selectedChunk?.chunkId}
        docName={selectedChunk?.docName}
        page={selectedChunk?.page}
      />
    </div>
  );
}
