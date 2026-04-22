/**
 * @fileoverview 파인만 학습 모드 API 서비스.
 * 백엔드 /api/feynman 엔드포인트와 통신한다.
 */
import api from './api';

/**
 * 임베딩 완료된 학습 가능 문서 목록을 조회한다.
 * @returns {Promise<Array<{id: string, fileName: string, pages: number, chunks: number}>>}
 */
export async function fetchDocs() {
  const { data } = await api.get('/feynman/docs');
  return data.data;
}

/**
 * 문서의 학습 가능한 챕터(주제) 목록을 조회한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<Array<{chapter: string, chunkCount: number}>>}
 */
export async function fetchTopics(docId) {
  const { data } = await api.get('/feynman/topics', { params: { docId } });
  return data.data;
}

/**
 * 사용자의 모든 문서를 상태와 함께 조회한다 (파이프라인 관리용).
 * @returns {Promise<Array<{id: string, fileName: string, pages: number, chunks: number, status: string, progress: number}>>}
 */
export async function fetchAllDocs() {
  const { data } = await api.get('/feynman/docs/all');
  return data.data;
}

/**
 * PDF 파일을 업로드한다.
 * @param {File} file - PDF 파일
 * @returns {Promise<{id: string, fileName: string, status: string}>}
 */
export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/feynman/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/**
 * 문서의 파이프라인(추출→그룹핑→임베딩)을 실행한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function runPipeline(docId) {
  const { data } = await api.post(`/feynman/pipeline/${docId}`);
  return data.data;
}

/**
 * 사용자의 개념 설명을 원본 텍스트와 대조하여 검증한다.
 * @param {Object} params
 * @param {string} params.docId - 문서 UUID
 * @param {string} params.chapter - 챕터명
 * @param {string} params.explanation - 사용자 설명
 * @param {string} [params.llm] - 사용할 LLM (기본: gpt-oss-20b)
 * @returns {Promise<{score: number, feedback: string, sources: Array}>}
 */
export async function verifyExplanation(params) {
  const { data } = await api.post('/feynman/verify', params);
  return data.data;
}

/**
 * SSE 스트리밍으로 파인만 대화형 학습을 진행한다.
 * chatApi.streamMessage와 동일한 SSE 프로토콜을 사용하되
 * 엔드포인트만 /api/feynman/stream으로 라우팅한다.
 *
 * @param {Object} params
 * @param {string} params.docId - 문서 UUID
 * @param {string} params.chapter - 챕터명
 * @param {string} [params.message] - 사용자 메시지 (비어있으면 AI가 먼저 질문)
 * @param {string} [params.conversationId] - 기존 대화 ID
 * @param {string} params.llm - 사용할 LLM
 * @param {Function} params.onToken - 토큰 수신 콜백
 * @param {Function} params.onDone - 완료 콜백
 * @param {AbortSignal} [params.signal] - 중단 시그널
 */
export async function streamFeynmanChat(params) {
  const { docId, chapter, message, conversationId, llm, onToken, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/feynman/stream`;
  const body = JSON.stringify({ docId, chapter, message: message || '', conversationId, llm });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);

  if (response.status === 401) {
    // refresh 시도 — chatApi와 동일 패턴
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      const err = new Error('로그인이 필요합니다');
      err.userMessage = '로그인이 필요합니다';
      err.status = 401;
      throw err;
    }
    try {
      const { data } = await import('axios').then((ax) =>
        ax.default.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken }),
      );
      accessToken = data.data.accessToken;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('auth-storage');
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

  // SSE 파싱 — chatApi.streamMessage와 동일한 프로토콜
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
            onDone?.({
              conversationId: parsed.conversationId,
              content: parsed.content || accumulated,
            });
          }
        } catch { /* skip unparseable lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
