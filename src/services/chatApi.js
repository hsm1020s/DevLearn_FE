import { API_CONFIG } from './api.config';
import * as mock from './mock/chatMock';
import api from './api';

/** @typedef {{ message: string, mode: string, llm: string, conversationId?: string }} ChatParams */

export async function sendMessage(params) {
  if (API_CONFIG.useMock) return mock.sendMessage(params);
  const { data } = await api.post('/chat', params);
  return data;
}

export async function streamMessage(params) {
  if (API_CONFIG.useMock) return mock.streamMessage(params);
  const { message, mode, llm, conversationId, onToken, onDone } = params;
  const response = await fetch(`${api.defaults.baseURL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode, llm, conversationId }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
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
}
