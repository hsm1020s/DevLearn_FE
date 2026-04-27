/**
 * @fileoverview LLM 활동 모니터 API. 권한 없이 호출 가능한 /api/public/llm-activity 엔드포인트만
 * 사용하므로, Authorization 헤더를 자동 첨부하는 기본 axios 인스턴스 대신 fetch 를 직접 쓴다.
 * 로그아웃 상태로 모니터 페이지에 진입해도 401 인터셉터가 발동하지 않는다.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * 현재 진행 중인 LLM 호출 + 최근 완료/실패 로그 + 소스별 누적 통계를 가져온다.
 * @returns {Promise<{inflight: Array, recent: Array, stats: Object, serverTimeMs: number}>}
 */
export async function fetchLlmActivity() {
  const res = await fetch(`${BASE_URL}/public/llm-activity`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`모니터 조회 실패 (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}
