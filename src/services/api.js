/**
 * @fileoverview Axios 인스턴스 생성 및 공통 인터셉터 설정.
 * 서버 에러(500+) 또는 404 응답 시 에러 페이지로 이동시킨다.
 */
import axios from 'axios';

/** 기본 baseURL, 타임아웃, 헤더가 설정된 Axios 인스턴스 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // 서버 에러(500+) 또는 404 시 에러 페이지로 이동
    if (status >= 500 || status === 404) {
      window.location.href = `/error/${status}`;
      return new Promise(() => {}); // 페이지 이동 중 후속 처리 방지
    }
    const message = error.response?.data?.message || error.message || '요청에 실패했습니다';
    return Promise.reject({ ...error, userMessage: message });
  },
);

export default api;
