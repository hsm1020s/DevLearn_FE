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
  const currentConvMessages = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.currentConversationId);
    return conv?.messages || [];
  });
  const isStreaming = useChatStore((s) => s.isStreaming);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const createConversation = useChatStore((s) => s.createConversation);
  const selectedLLM = useAppStore((s) => s.selectedLLM);

  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

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
  }, [currentConvMessages, streamingContent, scrollToBottom]);

  // 사용자 메시지 전송 및 SSE 스트리밍 수신 처리
  const handleSend = useCallback(
    async (content) => {
      // 대화가 없으면 새로 생성
      let convId = currentConversationId;
      if (!convId) {
        convId = createConversation(mode, selectedLLM);
      }
      addMessage({ role: 'user', content });
      setStreaming(true);
      setStreamingContent('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await streamMessage({
          message: content,
          mode,
          llm: selectedLLM,
          conversationId: convId,
          signal: controller.signal,
          onToken: (accumulated) => {
            if (!controller.signal.aborted) setStreamingContent(accumulated);
          },
          onDone: (result) => {
            if (!controller.signal.aborted) {
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
      } catch (err) {
        // AbortError는 정상 중단이므로 무시
        if (err.name !== 'AbortError') {
          setStreamingContent('');
          setStreaming(false);
        }
      }
    },
    [currentConversationId, createConversation, mode, selectedLLM, addMessage, setStreaming],
  );

  // 스트리밍 중단: SSE 연결을 끊고 현재까지 수신된 내용을 메시지로 확정
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingContent) {
      addMessage({ role: 'assistant', content: streamingContent });
    }
    setStreamingContent('');
    setStreaming(false);
  }, [streamingContent, addMessage, setStreaming]);

  return { messages: currentConvMessages, streamingContent, isStreaming, handleSend, handleStop, scrollRef };
}
