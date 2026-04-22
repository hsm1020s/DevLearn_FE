/**
 * @fileoverview 학습 API - PDF 업로드, 퀴즈 생성, 답안 제출 처리
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/studyMock';
import api from './api';

/** 학습용 PDF 파일을 업로드한다 */
export async function uploadPdf(file) {
  if (API_CONFIG.useMock) return mock.uploadPdf(file);
  const formData = new FormData();
  formData.append('file', file);
  // Content-Type을 명시하지 않아야 브라우저가 boundary를 자동 생성한다.
  // 대용량 파일(최대 1GB)을 위해 timeout을 10분으로 설정한다.
  const { data } = await api.post('/study/upload', formData, {
    timeout: 600_000,
  });
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/**
 * 업로드된 문서 기반으로 퀴즈를 생성한다.
 * `params.subject` (예: 'sqlp' | 'dap' | 'custom') — 과목 분류. 선택 필드이며
 * 백엔드가 지원하기 전까지는 mock에서만 사용된다.
 */
export async function generateQuiz(params) {
  if (API_CONFIG.useMock) return mock.generateQuiz(params);
  const { data } = await api.post('/study/generate-quiz', params);
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
