import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, BookOpen } from 'lucide-react';
import useChatStore from '../../stores/useChatStore';
import useAppStore from '../../stores/useAppStore';
import useRagStore from '../../stores/useRagStore';
import { streamMessage } from '../../services/chatApi';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import DocumentList from './DocumentList';
import SourcePanel from './SourcePanel';

export default function WorkStudyMode() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const createConversation = useChatStore((s) => s.createConversation);
  const selectedLLM = useAppStore((s) => s.selectedLLM);
  const ragDocs = useRagStore((s) => s.ragDocs);

  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const abortRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = useCallback(
    async (content) => {
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation('work');
      }

      addMessage({ role: 'user', content });
      setStreaming(true);
      setStreamingContent('');
      abortRef.current = false;

      try {
        await streamMessage({
          message: content,
          mode: 'work',
          llm: selectedLLM,
          conversationId: convId,
          onToken: (accumulated) => {
            if (!abortRef.current) {
              setStreamingContent(accumulated);
            }
          },
          onDone: (result) => {
            if (!abortRef.current) {
              addMessage({
                role: 'assistant',
                content: result.content,
                sources: result.sources,
              });
            }
            setStreamingContent('');
            setStreaming(false);
          },
        });
      } catch {
        setStreamingContent('');
        setStreaming(false);
      }
    },
    [currentConversationId, createConversation, addMessage, setStreaming, selectedLLM],
  );

  const handleStop = useCallback(() => {
    abortRef.current = true;
    if (streamingContent) {
      addMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, addMessage, setStreaming]);

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
