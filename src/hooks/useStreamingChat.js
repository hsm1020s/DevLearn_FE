/**
 * @fileoverview SSE 기반 스트리밍 채팅 커스텀 훅.
 * 메시지 전송, 토큰 단위 스트리밍 수신, 중단 처리, 자동 스크롤을 관리한다.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import useChatStore from '../stores/useChatStore';
import useAppStore from '../stores/useAppStore';
import { streamMessage } from '../services/chatApi';

/**
 * 스트리밍 채팅 훅
 * @param {string} mode - 채팅 모드 (general | cert | work)
 */
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

  // 채팅 영역을 맨 아래로 부드럽게 스크롤
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, []);

  // 메시지 추가 또는 스트리밍 내용 변경 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // 사용자 메시지 전송 및 SSE 스트리밍 수신 처리
  const handleSend = useCallback(
    async (content) => {
      // 대화가 없으면 새로 생성
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

  // 스트리밍 중단: 현재까지 수신된 내용을 메시지로 확정
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
