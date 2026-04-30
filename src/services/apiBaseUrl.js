/**
 * @fileoverview API baseURL 결정 헬퍼. 운영 빌드에서 VITE_API_URL이 누락되면
 * 명시적으로 throw 하여 사용자가 실수로 localhost 백엔드를 가리키는 빌드를
 * 배포하지 못하도록 한다. 개발 모드에서는 편의를 위해 기존 폴백을 유지한다.
 */

const DEV_FALLBACK = 'http://localhost:8080/api';

/**
 * 환경에 맞는 API baseURL을 반환한다.
 *  - VITE_API_URL이 있으면 그대로 사용
 *  - 없고 dev 모드면 DEV_FALLBACK 반환
 *  - 없고 prod 모드면 throw (운영 빌드 사고 방지)
 * @returns {string}
 */
export function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_API_URL is required for production build. ' +
        'Set it in .env.production or via the build environment.'
    );
  }

  return DEV_FALLBACK;
}
