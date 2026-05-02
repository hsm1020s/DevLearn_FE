/**
 * @fileoverview 강의 대본(Phase 1) API 서비스.
 * 백엔드 /api/lectures 엔드포인트와 통신한다.
 */
import api, { refreshAccessToken } from './api';

/**
 * 챕터 타이틀을 디스크 안전 이름으로 변환한다 (BE의 safeChapter 와 같은 규칙).
 * 일괄 생성 시 status 응답의 폴더명과 비교용.
 */
export function safeChapterName(chapter) {
  if (!chapter) return 'chapter';
  const safe = chapter.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return safe || 'chapter';
}

/**
 * 문서 단위 강의 대본 생성 현황 조회 — 이미 생성된 챕터의 safe-name 폴더 목록.
 * @param {string} docId
 * @returns {Promise<Set<string>>} safe-name Set
 */
export async function fetchLectureStatus(docId) {
  const { data } = await api.get(`/lectures/${encodeURIComponent(docId)}/status`);
  const generated = data?.data?.generated || [];
  return new Set(generated);
}

/**
 * 저장된 강의 대본 markdown 을 조회한다. 없으면 null.
 * @param {string} docId 문서 UUID
 * @param {string} chapter 챕터명
 * @returns {Promise<string|null>}
 */
export async function fetchLectureScript(docId, chapter) {
  try {
    const { data } = await api.get(
      `/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/script`,
      { responseType: 'text', transformResponse: (v) => v },
    );
    return data || '';
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/**
 * 강의 대본을 SSE 로 스트림 생성한다. 종료 시 서버가 디스크에 저장한다.
 *
 * @param {Object} params
 * @param {string} params.docId
 * @param {string} params.chapter
 * @param {string} [params.llm]
 * @param {Function} params.onToken (accumulated)
 * @param {Function} params.onDone ({content})
 * @param {AbortSignal} [params.signal]
 */
export async function streamLectureScript(params) {
  const { docId, chapter, llm, onToken, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/script/stream`;
  const body = JSON.stringify({ llm });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);

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
    let msg = `요청 실패 (${response.status})`;
    try {
      const b = await response.json();
      if (b?.message) msg = b.message;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.userMessage = msg;
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5));
          if (parsed.type === 'token') {
            accumulated = parsed.content;
            onToken?.(accumulated);
          } else if (parsed.type === 'done') {
            onDone?.({ content: parsed.content || accumulated });
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
