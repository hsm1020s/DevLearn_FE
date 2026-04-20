/**
 * @fileoverview SSE 기반 스트리밍 채팅 커스텀 훅.
 * 메시지 전송, 토큰 단위 스트리밍 수신, 중단 처리, 자동 스크롤을 관리한다.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import useChatStore from '../stores/useChatStore';
import useAppStore from '../stores/useAppStore';
import { streamMessage } from '../services/chatApi';
import { showError } from '../utils/errorHandler';

/**
 * 스트리밍 채팅 훅
 * @param {string} mode - 채팅 모드 (general | cert | work)
 */
export default function useStreamingChat(mode) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const currentConvMessages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    return conv?.messages || [];
  }, [conversations, currentConversationId]);
  const isStreaming = useChatStore((s) => s.isStreaming);
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

  // 메시지 추가, 스트리밍 내용 변경, 로딩 버블 등장 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [currentConvMessages, streamingContent, isStreaming, scrollToBottom]);

  // 스트리밍 요청 실행 헬퍼 (409 재시도 로직에서 재사용)
  const doStream = useCallback(
    async (content, convId, controller) => {
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
    },
    [mode, selectedLLM, addMessage, setStreaming],
  );

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
        await doStream(content, convId, controller);
      } catch (err) {
        if (err.name === 'AbortError') return; // 정상 중단

        // 409 Conflict — 로컬 대화 ID가 서버에 없거나 충돌. 대화를 새로 만들어 재시도
        if (err.status === 409) {
          console.warn('[useStreamingChat] 409 Conflict, 새 대화로 재시도');
          const { deleteConversations: removeConvs } = useChatStore.getState();
          removeConvs([convId]);
          const newConvId = createConversation(mode, selectedLLM);
          addMessage({ role: 'user', content });
          try {
            await doStream(content, newConvId, controller);
            return;
          } catch (retryErr) {
            if (retryErr.name === 'AbortError') return;
            console.error('[useStreamingChat] Retry failed:', retryErr);
            showError(retryErr);
          }
        } else {
          console.error('[useStreamingChat] Stream error:', err);
          showError(err);
        }
        setStreamingContent('');
        setStreaming(false);
      }
    },
    [currentConversationId, createConversation, mode, selectedLLM, addMessage, setStreaming, doStream],
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
