import { useState, useRef, useCallback, useEffect } from 'react';
import useChatStore from '../stores/useChatStore';
import useAppStore from '../stores/useAppStore';
import { streamMessage } from '../services/chatApi';

export default function useStreamingChat(mode) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const createConversation = useChatStore((s) => s.createConversation);
  const selectedLLM = useAppStore((s) => s.selectedLLM);

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
        convId = createConversation(mode);
      }
      addMessage({ role: 'user', content });
      setStreaming(true);
      setStreamingContent('');
      abortRef.current = false;

      try {
        await streamMessage({
          message: content,
          mode,
          llm: selectedLLM,
          conversationId: convId,
          onToken: (accumulated) => {
            if (!abortRef.current) setStreamingContent(accumulated);
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
    [currentConversationId, createConversation, mode, selectedLLM, addMessage, setStreaming],
  );

  const handleStop = useCallback(() => {
    abortRef.current = true;
    if (streamingContent) {
      addMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, addMessage, setStreaming]);

  return { messages, streamingContent, isStreaming, handleSend, handleStop, scrollRef };
}
