/**
 * @fileoverview Axios 인스턴스 생성 및 공통 인터셉터 설정.
 * 401 응답 시 토큰 자동 갱신을 시도하며, 그 외 에러는 호출측/errorHandler에 위임한다.
 */
import axios from 'axios';

/** 기본 baseURL, 타임아웃, 헤더가 설정된 Axios 인스턴스 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: Access Token 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401 시 토큰 자동 갱신, 그 외 에러는 호출측(토스트 등)에 위임
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 401이고 재시도가 아닌 경우에만 토큰 갱신 시도
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // 토큰 갱신 요청 (인터셉터 무한루프 방지를 위해 새 axios 인스턴스 사용)
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
        );

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 갱신 실패 시 로그아웃 처리 후 메인 페이지로 이동
        // auth-storage(zustand persist)도 함께 제거해야 isLoggedIn 잔존으로 인한
        // 재시도 루프(로그인 상태 복원 → 401 → refresh 실패 → 리로드 반복)를 막을 수 있다.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth-storage');
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    // 500/404 전역 리다이렉트 제거 — 호출측에서 토스트 등으로 처리하도록 위임
    const message = error.response?.data?.message || error.message || '요청에 실패했습니다';
    return Promise.reject({ ...error, userMessage: message });
  },
);

export default api;
