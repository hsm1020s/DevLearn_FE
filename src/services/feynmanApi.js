/**
 * @fileoverview 파인만 학습 모드 API 서비스.
 * 백엔드 /api/feynman 엔드포인트와 통신한다.
 */
import api, { refreshAccessToken } from './api';

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
 * 파이프라인 관리 화면용 문서 페이지 조회.
 * @param {Object} [params]
 * @param {number} [params.page=0]   - 0-base 페이지 번호
 * @param {number} [params.size=15]  - 페이지당 건수
 * @param {string} [params.status='all'] - 상태 필터 (all|uploaded|processing|completed|error)
 * @returns {Promise<{items: Array, totalCount: number, page: number, size: number, totalPages: number}>}
 */
export async function fetchDocsPage({ page = 0, size = 15, status = 'all' } = {}) {
  const { data } = await api.get('/feynman/docs/all', { params: { page, size, status } });
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
 * 문서의 파이프라인을 실행한다.
 * @param {string} docId - 문서 UUID
 * @param {{skipEmbed?: boolean}} [options] - skipEmbed=true 면 임베딩 단계 보류 (extract/toc/group/마인드맵 까지만)
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function runPipeline(docId, options = {}) {
  const params = options.skipEmbed ? { skipEmbed: true } : undefined;
  const { data } = await api.post(`/feynman/pipeline/${docId}`, null, { params });
  return data.data;
}

/**
 * skipEmbed 로 미리 돌려둔 문서에 대해 임베딩 단계만 단독 실행한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function runEmbedOnly(docId) {
  const { data } = await api.post(`/feynman/pipeline/${docId}/embed`);
  return data.data;
}

/**
 * TOC + chapters 그룹핑만 재실행한다 (extract 결과 재사용, embed 는 그대로).
 * @param {string} docId - 문서 UUID
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function retryToc(docId) {
  const { data } = await api.post(`/feynman/pipeline/${docId}/retry-toc`);
  return data.data;
}

/**
 * 문서와 모든 연관 데이터를 삭제한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function deleteDoc(docId) {
  const { data } = await api.delete(`/feynman/docs/${docId}`);
  return data.data;
}

/**
 * 여러 문서를 파이프라인 큐에 일괄 등록한다.
 * @param {string[]} docIds - 문서 UUID 배열
 * @param {Object} options
 * @param {string} options.mode - 실행 모드 (full, skip_embed, embed_only)
 * @returns {Promise<{enqueuedCount: number, skippedCount: number}>}
 */
export async function enqueueBatch(docIds, { mode = 'skip_embed' } = {}) {
  const { data } = await api.post('/feynman/queue/enqueue-batch', { docIds, mode });
  return data.data;
}

/**
 * 현재 큐 상태를 조회한다.
 * @returns {Promise<{running: Array, queued: Array, completedCount: number, failedCount: number}>}
 */
export async function fetchQueueStatus() {
  const { data } = await api.get('/feynman/queue/status');
  return data.data;
}

/**
 * 큐 항목을 취소한다.
 * @param {string} queueItemId - 큐 항목 UUID
 */
export async function cancelQueueItem(queueItemId) {
  const { data } = await api.delete(`/feynman/queue/${queueItemId}`);
  return data.data;
}

/**
 * 모든 대기 중인 큐 항목을 취소한다.
 */
export async function cancelAllQueue() {
  const { data } = await api.delete('/feynman/queue');
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
 * 문서의 전체 챕터와 마인드맵 생성 상태를 조회한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<Array<{chapter: string, status: 'completed'|'not_generated', mindmapId: string|null, nodeCount: number}>>}
 */
export async function fetchChapterStatuses(docId) {
  const { data } = await api.get(`/feynman/mindmap/chapters/${docId}`);
  return data.data;
}

/**
 * 선택한 챕터의 마인드맵을 비동기로 생성 시작한다.
 * @param {string} docId - 문서 UUID
 * @param {string[]} [chapters] - 생성할 챕터명 목록 (비어있으면 전체)
 * @returns {Promise<{docId: string, message: string}>}
 */
export async function generateMindmaps(docId, chapters) {
  const { data } = await api.post(`/feynman/mindmap/generate/${docId}`, { chapters });
  return data.data;
}

/**
 * 문서에 연결된 챕터별 마인드맵 목록을 조회한다.
 * @param {string} docId - 문서 UUID
 * @returns {Promise<Array<{id: string, title: string, mode: string, docId: string, chapter: string, nodeCount: number}>>}
 */
export async function fetchMindmapsByDoc(docId) {
  const { data } = await api.get(`/feynman/mindmap/by-doc/${docId}`);
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
    // 공유 single-flight refresh 사용 — 동시 401에도 /auth/refresh 는 1회만 호출된다
    try {
      accessToken = await refreshAccessToken();
    } catch {
      const err = new Error('로그인이 필요합니다');
      err.userMessage = '로그인이 필요합니다';
      err.errorCode = 'UNAUTHORIZED';
      err.status = 401;
      throw err;
    }
    response = await doFetch(accessToken);
  }

  if (!response.ok) {
    // ApiResponse({success,message,errorCode}) 본문에서 둘 다 추출해 토스트에 노출.
    let msg = `요청 실패 (${response.status})`;
    let errorCode = null;
    try {
      const b = await response.json();
      if (b?.message) msg = b.message;
      if (b?.errorCode) errorCode = b.errorCode;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.userMessage = msg;
    err.errorCode = errorCode;
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
              sources: parsed.sources,
            });
          }
        } catch { /* skip unparseable lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
