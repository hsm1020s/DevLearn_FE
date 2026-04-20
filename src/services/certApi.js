/**
 * @fileoverview 자격증 학습 API - PDF 업로드, 퀴즈 생성, 답안 제출 처리
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/certMock';
import api from './api';

/** 자격증 학습용 PDF 파일을 업로드한다 */
export async function uploadPdf(file) {
  if (API_CONFIG.useMock) return mock.uploadPdf(file);
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/cert/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 업로드된 문서 기반으로 퀴즈를 생성한다 */
export async function generateQuiz(params) {
  if (API_CONFIG.useMock) return mock.generateQuiz(params);
  const { data } = await api.post('/cert/generate-quiz', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 사용자의 퀴즈 답안을 제출하고 채점 결과를 반환한다 */
export async function submitAnswer(params) {
  if (API_CONFIG.useMock) return mock.submitAnswer(params);
  const { data } = await api.post('/cert/submit', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/**
 * 자격증 학습 누적 통계를 조회한다.
 * @returns {Promise<{totalSolved:number, correctCount:number, correctRate:number,
 *   byDifficulty: Array<{difficulty:string,total:number,correct:number,rate:number}>,
 *   byType: Array<{type:string,total:number,correct:number,rate:number}>}>}
 */
export async function getCertStats() {
  if (API_CONFIG.useMock) return mock.getCertStats();
  const { data } = await api.get('/cert/stats');
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}
