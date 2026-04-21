/**
 * @fileoverview Axios 인스턴스 생성 및 공통 인터셉터 설정.
 * 401 응답 시 토큰 자동 갱신을 시도하며, 그 외 에러는 호출측/errorHandler에 위임한다.
 */
import axios from 'axios';

/** 기본 baseURL, 타임아웃이 설정된 Axios 인스턴스 */
// Content-Type을 기본 헤더로 고정하지 않는다.
// JSON 요청은 axios가 객체를 감지하여 자동으로 application/json을 설정하고,
// FormData 요청은 브라우저가 multipart/form-data + boundary를 자동 생성한다.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 30000,
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
        // 갱신 실패 시 소프트 로그아웃. 하드 리다이렉트를 하면 마인드맵 패널,
        // 작성 중이던 노드 등 in-flight UI 상태가 전부 날아가므로 피한다.
        // 동적 import로 api ↔ useAuthStore 순환 의존을 회피한다.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        const [{ default: useAuthStore }, { showError }] = await Promise.all([
          import('../stores/useAuthStore'),
          import('../utils/errorHandler'),
        ]);
        useAuthStore.getState().logout();
        showError(null, '세션이 만료되었습니다. 다시 로그인해주세요.');
        return Promise.reject(refreshError);
      }
    }

    // 500/404 전역 리다이렉트 제거 — 호출측에서 토스트 등으로 처리하도록 위임
    const message = error.response?.data?.message || error.message || '요청에 실패했습니다';
    return Promise.reject({ ...error, userMessage: message });
  },
);

export default api;
