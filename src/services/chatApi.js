/**
 * @fileoverview 채팅 API - 일반/자격증/업무 모드별 메시지 송수신 처리
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/chatMock';
import api from './api';

/** @typedef {{ message: string, mode: string, llm: string, conversationId?: string }} ChatParams */

/** 단일 메시지를 전송하고 응답을 반환한다 */
export async function sendMessage(params) {
  if (API_CONFIG.useMock) return mock.sendMessage(params);
  const { data } = await api.post('/chat', params);
  return data;
}

/** SSE 기반 스트리밍으로 메시지를 전송하고 토큰 단위로 콜백을 호출한다 */
export async function streamMessage(params) {
  if (API_CONFIG.useMock) return mock.streamMessage(params);
  const { message, mode, llm, conversationId, onToken, onDone, signal } = params;
  const response = await fetch(`${api.defaults.baseURL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode, llm, conversationId }),
    signal,
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data:'));
      for (const line of lines) {
        const parsed = JSON.parse(line.slice(5));
        if (parsed.type === 'token') {
          accumulated += parsed.content;
          onToken?.(accumulated);
        } else if (parsed.type === 'done') {
          onDone?.({ conversationId: parsed.conversationId, content: accumulated, sources: parsed.sources });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
