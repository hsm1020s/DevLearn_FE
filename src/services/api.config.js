/**
 * @fileoverview API 환경 설정 - Mock/실제 API 전환을 관리하는 설정 파일
 */

/** API 전역 설정 객체 — 기본값은 Real API, Mock은 VITE_MOCK_API=true로 명시적 활성화 */
export const API_CONFIG = {
  useMock: import.meta.env.VITE_MOCK_API === 'true',
};
