/**
 * @fileoverview 파인만 학습 모드 API 서비스.
 * 백엔드 /api/feynman 엔드포인트와 통신한다.
 */
import api from './api';

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
