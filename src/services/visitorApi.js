/**
 * @fileoverview 사이트 누적 방문자수 API 서비스.
 *
 * /api/public/** 은 BE SecurityConfig 에서 permitAll 로 노출되어 미로그인 상태에서도 호출 가능.
 * 새로 마운트되는 App 에서 sessionStorage 가드와 함께 hitVisit() 또는 getVisitCount() 를 호출하고,
 * 결과(totalCount)를 사이드바 로고 아래 캡션에 표시한다.
 */
import api from './api';

/**
 * 방문 기록 + 최신 누적치 반환. 서버측에서 봇/IP 24h 가드를 통과한 경우에만 +1.
 * 가드에 걸려도 현재 누적치를 그대로 응답하므로 실패가 아님.
 * @returns {Promise<{ totalCount: number }>}
 */
export async function hitVisit() {
  const { data } = await api.post('/public/visits/hit');
  return data.data;
}

/**
 * 누적 방문자수 조회 (카운트 변경 없음).
 * @returns {Promise<{ totalCount: number }>}
 */
export async function getVisitCount() {
  const { data } = await api.get('/public/visits/count');
  return data.data;
}
