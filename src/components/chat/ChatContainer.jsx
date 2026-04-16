import { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import useChatStore from '../../stores/useChatStore';
import useAppStore from '../../stores/useAppStore';
import { streamMessage } from '../../services/chatApi';
import { MAIN_MODES } from '../../utils/constants';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

const EXAMPLE_QUESTIONS = [
  'React와 Vue의 차이점은?',
  '정보처리기사 실기 팁 알려줘',
  '사내 휴가 규정 알려줘',
];

export default function ChatContainer() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const createConversation = useChatStore((s) => s.createConversation);

  const selectedLLM = useAppStore((s) => s.selectedLLM);
  const mainMode = useAppStore((s) => s.mainMode);

  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef(false);
  const bottomRef = useRef(null);

  const modeLabel = MAIN_MODES.find((m) => m.value === mainMode)?.label ?? '일반검색';

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(
    async (text) => {
      abortRef.current = false;

      // 대화가 없으면 새로 생성
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation(mainMode);
      }

      addMessage({ role: 'user', content: text });
      setStreaming(true);
      setStreamingContent('');

      await streamMessage({
        message: text,
        mode: mainMode,
        llm: selectedLLM,
        conversationId: convId,
        onToken: (accumulated) => {
          if (abortRef.current) return;
          setStreamingContent(accumulated);
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
    },
    [currentConversationId, createConversation, mainMode, selectedLLM, addMessage, setStreaming],
  );

  const handleStop = useCallback(() => {
    abortRef.current = true;
    if (streamingContent) {
      addMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, addMessage, setStreaming]);

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
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
            <div ref={bottomRef} />
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

/* ---------- 환영 메시지 ---------- */
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
