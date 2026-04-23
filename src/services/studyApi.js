/**
 * @fileoverview 학습 API - 퀴즈 생성, 답안 제출, 통계 조회 처리
 * (PDF 업로드는 파인만 파이프라인으로 통합 — feynmanApi.uploadPdf 참조)
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/studyMock';
import api from './api';

/**
 * 업로드된 문서 기반으로 퀴즈를 생성한다.
 * `params.subject` (예: 'sqlp' | 'dap' | 'custom') — 과목 분류. 선택 필드이며
 * 백엔드가 지원하기 전까지는 mock에서만 사용된다.
 */
export async function generateQuiz(params) {
  if (API_CONFIG.useMock) return mock.generateQuiz(params);
  // 로컬 32B LLM 은 첫 생성 시 2~3분까지 걸리므로 전역 30초 타임아웃을 5분으로 확장.
  // 캐시 hit 시에는 즉시 반환되므로 이 타임아웃이 실제로 쓰이는 경우는 최초 생성뿐.
  const { data } = await api.post('/study/generate-quiz', params, { timeout: 300_000 });
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/**
 * 사용자의 퀴즈 답안을 제출하고 채점 결과를 반환한다.
 * `params.subject` 는 선택. 백엔드 연결 전까지 mock에서만 의미가 있다.
 */
export async function submitAnswer(params) {
  if (API_CONFIG.useMock) return mock.submitAnswer(params);
  const { data } = await api.post('/study/submit', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/**
 * 학습 누적 통계를 조회한다. 과목별 분리가 가능해지면 `subject` 쿼리로 요청.
 * @param {{subject?: string}} [params]
 * @returns {Promise<{totalSolved:number, correctCount:number, correctRate:number,
 *   byDifficulty: Array<{difficulty:string,total:number,correct:number,rate:number}>,
 *   byType: Array<{type:string,total:number,correct:number,rate:number}>,
 *   subject?: string}>}
 */
export async function getStudyStats(params = {}) {
  if (API_CONFIG.useMock) return mock.getStudyStats(params);
  const { data } = await api.get('/study/stats', { params });
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}
