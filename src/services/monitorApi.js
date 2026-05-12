/**
 * @fileoverview LLM 활동 모니터 API. 인증 필수 /api/monitor/llm-activity 엔드포인트를 사용한다.
 * 인증된 axios 인스턴스(api)를 통해 JWT 토큰을 자동 첨부한다.
 */

import api from './api';

/**
 * 현재 진행 중인 LLM 호출 + 최근 완료/실패 로그 + 소스별 누적 통계를 가져온다.
 * 비로그인 상태에서는 401 에러가 발생한다.
 * @returns {Promise<{inflight: Array, recent: Array, stats: Object, serverTimeMs: number}>}
 */
export async function fetchLlmActivity() {
  const { data } = await api.get('/monitor/llm-activity');
  return data.data;
}
