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
  // 백엔드 ApiResponse 래핑 해제: response.data가 ApiResponse이므로 data.data가 실제 데이터
  return data.data;
}

/** SSE 기반 스트리밍으로 메시지를 전송하고 토큰 단위로 콜백을 호출한다 */
export async function streamMessage(params) {
  if (API_CONFIG.useMock) return mock.streamMessage(params);
  const { message, mode, llm, conversationId, onToken, onDone, signal } = params;
  // fetch 기반 스트리밍은 axios 인터셉터를 거치지 않으므로 JWT 헤더를 직접 추가
  const accessToken = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${api.defaults.baseURL}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, mode, llm, conversationId }),
    signal,
  });
  // HTTP 에러 상태 시 에러 페이지로 이동
  if (!response.ok) {
    window.location.href = `/error/${response.status}`;
    return;
  }
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
