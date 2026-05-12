/**
 * @fileoverview 기능개선 제안 API 클라이언트.
 *
 * `SuggestionModal` 의 제출 흐름에서 호출된다. JWT 토큰은 공통 axios 인스턴스의
 * 인터셉터가 자동으로 부착하므로, 호출측은 페이로드만 신경 쓰면 된다.
 *
 * 백엔드는 `ApiResponse<T>` 래핑을 사용하므로 `response.data.data` 를 풀어서 반환한다.
 */
import api from './api';

/**
 * 새 기능개선 제안을 백엔드에 등록한다.
 *
 * @param {{categories: string[], title: string, content: string}} payload
 * @returns {Promise<{id: string, createdAt: string}>}
 */
export async function submitSuggestion(payload) {
  const { data } = await api.post('/suggestions', payload);
  return data.data;
}

/**
 * 관리자 전용 — 전체 제안 목록을 작성자 메타와 함께 최신순으로 조회한다.
 * `/api/admin/suggestions` 는 SecurityConfig 에서 ROLE_ADMIN 강제이므로 일반 유저는 403.
 *
 * @returns {Promise<Array<{
 *   id:string, userId:string, userName:string|null, userEmail:string|null,
 *   title:string, content:string, categories:string[], createdAt:string
 * }>>}
 */
export async function listAdminSuggestions() {
  const { data } = await api.get('/admin/suggestions');
  return data.data;
}
