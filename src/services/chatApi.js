/**
 * @fileoverview 채팅 API - 일반/자격증/업무 모드별 메시지 송수신 처리
 */
import axios from 'axios';
import { API_CONFIG } from './api.config';
import * as mock from './mock/chatMock';
import api from './api';

/**
 * refreshToken으로 accessToken 갱신을 시도한다. 성공 시 새 accessToken 반환.
 * 실패 시 tokens/auth-storage를 정리하고 throw한다.
 * @returns {Promise<string>}
 */
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');
  try {
    const { data } = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refreshToken },
    );
    const newAccessToken = data.data.accessToken;
    const newRefreshToken = data.data.refreshToken;
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    return newAccessToken;
  } catch (err) {
    // refresh 실패 → 인증 정보 모두 정리 (api.js 인터셉터와 동일 정책)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('auth-storage');
    throw err;
  }
}

/** @typedef {{ message: string, mode: string, llm: string, conversationId?: string }} ChatParams */

/** 단일 메시지를 전송하고 응답을 반환한다 */
export async function sendMessage(params) {
  if (API_CONFIG.useMock) return mock.sendMessage(params);
  const { data } = await api.post('/chat', params);
  // 백엔드 ApiResponse 래핑 해제: response.data가 ApiResponse이므로 data.data가 실제 데이터
  return data.data;
}

/**
 * 서버에 저장된 대화 목록(메타데이터)을 조회한다.
 * @returns {Promise<Array<{id:string,title:string,mode:string,llm:string,isFavorite?:boolean,createdAt:string,updatedAt:string}>>}
 */
export async function listConversations() {
  if (API_CONFIG.useMock) return mock.listConversations();
  const { data } = await api.get('/chat/conversations');
  return data.data;
}

/**
 * 클라이언트가 지정한 id로 빈 대화를 서버에 미리 생성한다 (idempotent).
 * 새 대화 생성 직후 메시지 전송 전이라도 즐겨찾기/이름변경이 404 없이 동작하도록
 * 서버 레코드를 사전 확보하는 용도.
 * @param {{id:string, mode:string, llm:string, title?:string, isFavorite?:boolean}} payload
 * @returns {Promise<{id:string,title:string,mode:string,llm:string,isFavorite:boolean}>}
 */
export async function createConversation(payload) {
  if (API_CONFIG.useMock) return mock.createConversation?.(payload) ?? payload;
  const { data } = await api.post('/chat/conversations', payload);
  return data.data;
}

/**
 * 대화 메타데이터(제목/즐겨찾기)를 서버에 부분 갱신한다.
 * @param {string} id
 * @param {{title?:string, isFavorite?:boolean}} patch
 * @returns {Promise<void>}
 */
export async function updateConversation(id, patch) {
  if (API_CONFIG.useMock) return mock.updateConversation(id, patch);
  const { data } = await api.patch(`/chat/conversations/${id}`, patch);
  return data.data;
}

/**
 * 대화 목록을 서버에서 일괄 삭제한다. axios는 DELETE body를 config.data로 전달한다.
 * @param {string[]} ids
 * @returns {Promise<void>}
 */
export async function deleteConversations(ids) {
  if (API_CONFIG.useMock) return mock.deleteConversations(ids);
  const { data } = await api.delete('/chat/conversations', { data: { ids } });
  return data.data;
}

/**
 * SSE 기반 스트리밍으로 메시지를 전송하고 토큰 단위로 콜백을 호출한다.
 * 401 수신 시 refreshToken으로 1회 재시도하며, refresh 실패/재시도 실패 시
 * userMessage를 가진 에러를 throw하여 호출측(useStreamingChat)이 토스트로 처리한다.
 */
export async function streamMessage(params) {
  if (API_CONFIG.useMock) return mock.streamMessage(params);
  const { message, mode, llm, conversationId, onToken, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/chat/stream`;
  const body = JSON.stringify({ message, mode, llm, conversationId });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);

  // 401 → refresh 시도 후 1회 재시도. 실패 시 사용자 친화적 에러로 throw.
  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      const err = new Error('로그인이 필요합니다');
      err.userMessage = '로그인이 필요합니다';
      err.status = 401;
      throw err;
    }
    response = await doFetch(accessToken);
  }

  if (!response.ok) {
    // 서버가 JSON 에러 본문을 내려주면 message를 뽑아 토스트에 노출
    let message = `요청 실패 (${response.status})`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch { /* 본문 파싱 실패는 무시 */ }
    const err = new Error(message);
    err.userMessage = message;
    err.status = response.status;
    throw err;
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
          accumulated = parsed.content;
          onToken?.(accumulated);
        } else if (parsed.type === 'done') {
          onDone?.({ conversationId: parsed.conversationId, content: parsed.content || accumulated, sources: parsed.sources });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
