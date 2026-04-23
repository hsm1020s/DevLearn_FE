/**
 * @fileoverview 학습 API - 퀴즈 생성, 답안 제출, 통계 조회 처리
 * (PDF 업로드는 파인만 파이프라인으로 통합 — feynmanApi.uploadPdf 참조)
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/studyMock';
import api from './api';

/**
 * 퀴즈 생성 요청. 서버는 즉시 `{ quizId, status }` 를 반환하고 (processing 이면 백엔드가
 * 백그라운드 잡으로 LLM 호출), 프론트는 `fetchQuizStatus` 로 3초 간격 폴링해 완료되면
 * 문제 목록을 받는다. 캐시 hit 이면 첫 응답에서 `status="completed" + questions` 가 바로 옴.
 */
export async function generateQuiz(params) {
  if (API_CONFIG.useMock) return mock.generateQuiz(params);
  const { data } = await api.post('/study/generate-quiz', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 퀴즈 잡 상태 폴링. completed 면 questions 포함, failed 면 errorMessage 포함. */
export async function fetchQuizStatus(quizId) {
  if (API_CONFIG.useMock) return mock.fetchQuizStatus(quizId);
  const { data } = await api.get(`/study/quizzes/${encodeURIComponent(quizId)}`);
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
