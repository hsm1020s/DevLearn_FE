/**
 * @fileoverview 업무학습 모드 — RAG 기반 문서 질의응답 채팅 화면.
 * 빈 상태에서는 입력창이 중앙에 위치하고, 대화 시작 후 하단으로 이동한다.
 * 우측에 업로드된 문서 목록 패널을 배치한다.
 */
import { Upload, BookOpen } from 'lucide-react';
import useDocStore from '../../stores/useDocStore';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import DocumentList from './DocumentList';
import SourcePanel from './SourcePanel';

/** 업무학습 모드 메인 컴포넌트 */
export default function WorkStudyMode() {
  const docs = useDocStore((s) => s.docs);
  const { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef } =
    useStreamingChat('work');

  const hasDocuments = docs.length > 0;
  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex h-full">
      {/* 좌측: 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {isEmpty ? (
          /* 빈 상태 — 입력창이 화면 중앙에 위치 */
          <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ marginTop: '-10%' }}>
            <div className="w-full max-w-2xl flex flex-col items-center gap-6">
              {/* 환영 메시지 */}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                {hasDocuments
                  ? <BookOpen size={24} className="text-primary" />
                  : <Upload size={24} className="text-primary" />}
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-text-primary">
                  업무학습 모드
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  {hasDocuments
                    ? '업로드된 문서를 기반으로 질문해보세요'
                    : '사이드바에서 PDF를 업로드하고 질문해보세요'}
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
            </div>
          </div>
        ) : (
          /* 대화 진행 중 — 메시지 목록 + 하단 입력창 */
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
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
                    message={{ id: '__streaming', role: 'assistant', content: streamingContent }}
                    isStreaming
                  />
                )}
              </div>
            </div>

            <div className="max-w-3xl mx-auto w-full">
              <ChatInput
                onSend={handleSend}
                isStreaming={isStreaming}
                onStop={handleStop}
              />
            </div>
          </>
        )}
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
    </div>
  );
}
