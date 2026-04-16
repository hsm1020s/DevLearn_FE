import { Upload, BookOpen } from 'lucide-react';
import useRagStore from '../../stores/useRagStore';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import DocumentList from './DocumentList';
import SourcePanel from './SourcePanel';

export default function WorkStudyMode() {
  const ragDocs = useRagStore((s) => s.ragDocs);
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat('work');

  const hasDocuments = ragDocs.length > 0;

  return (
    <div className="flex h-full">
      {/* 좌측: 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streamingContent ? (
            <EmptyState hasDocuments={hasDocuments} />
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  <ChatMessage message={msg} />
                  {msg.role === 'assistant' && msg.sources && (
                    <div className="ml-10 mt-1">
                      <SourcePanel sources={msg.sources} />
                    </div>
                  )}
                </div>
              ))}

              {isStreaming && streamingContent && (
                <ChatMessage
                  message={{ role: 'assistant', content: streamingContent }}
                  isStreaming
                />
              )}
            </>
          )}
        </div>

        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
        />
      </div>

      {/* 우측: 문서 패널 */}
      <div className="
        w-[240px] shrink-0
        border-l border-border-light bg-bg-primary
        hidden md:flex flex-col
      ">
        <DocumentList />
      </div>
    </div>
  );
}

function EmptyState({ hasDocuments }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      {hasDocuments ? (
        <>
          <BookOpen size={48} className="text-text-secondary mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            업무 문서 기반 질의응답
          </h2>
          <p className="text-sm text-text-secondary max-w-sm">
            업로드된 문서를 기반으로 질문해보세요.
            AI가 관련 내용을 찾아 답변합니다.
          </p>
        </>
      ) : (
        <>
          <Upload size={48} className="text-text-secondary mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            PDF 문서를 업로드하고 질문해보세요
          </h2>
          <p className="text-sm text-text-secondary max-w-sm">
            사내 규정, 가이드 등 PDF 문서를 업로드하면
            RAG 기반으로 정확한 답변을 받을 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
