/**
 * @fileoverview Axios 인스턴스 생성 및 공통 인터셉터 설정.
 * 401 응답 시 토큰 자동 갱신을 시도하며, 그 외 에러는 호출측/errorHandler에 위임한다.
 *
 * refresh 동시성 제어:
 *  - 여러 요청이 동시에 401을 받아도 `/auth/refresh` 호출은 1회만 발생하도록
 *    `refreshPromise` 싱글톤으로 단일화한다(single-flight).
 *  - SSE 스트리밍 등 axios 외부의 fetch 경로에서도 동일한 refresh 함수를 재사용할 수 있도록
 *    `refreshAccessToken` 을 export 한다.
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

/**
 * 동시 401 요청들이 refresh 를 중복 호출하지 않도록 단일 Promise 를 공유한다.
 * 첫 번째 요청이 refresh 를 시작하면 나머지 요청은 이 Promise 를 await 만 한다.
 */
let refreshPromise = null;

/**
 * refreshToken 으로 새 accessToken 을 발급받는다.
 *  - 동시 호출이 들어오면 진행 중인 Promise 를 그대로 반환(single-flight) — 한 번만 서버에 요청한다.
 *  - 실패 시 인증 정보를 모두 정리하고 throw 하여 호출측이 로그아웃 처리하도록 한다.
 * @returns {Promise<string>} 새 accessToken
 */
export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    try {
      // 인터셉터 무한루프 방지를 위해 base axios 사용
      const { data } = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
      );
      const newAccessToken = data.data.accessToken;
      const newRefreshToken = data.data.refreshToken;
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      return newAccessToken;
    } catch (err) {
      // refresh 실패 → 토큰/persist 정리 (호출측이 후속 정리/리다이렉트 결정)
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('auth-storage');
      throw err;
    }
  })().finally(() => {
    // 다음 401 부터 다시 새 갱신을 시도할 수 있도록 슬롯을 비운다
    refreshPromise = null;
  });

  return refreshPromise;
}

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
        const newAccessToken = await refreshAccessToken();
        // 원래 요청 재시도 — 갱신된 토큰으로 헤더 갱신
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 갱신 실패 시 소프트 로그아웃. 하드 리다이렉트를 하면 마인드맵 패널,
        // 작성 중이던 노드 등 in-flight UI 상태가 전부 날아가므로 피한다.
        // 동적 import로 api ↔ useAuthStore 순환 의존을 회피한다.
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
