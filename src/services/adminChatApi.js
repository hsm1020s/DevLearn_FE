/**
 * @fileoverview 관리자 채팅 모니터링 API.
 *
 * BE 의 /api/admin/conversations 두 엔드포인트를 호출. SecurityConfig 가 /api/admin/**
 * ROLE_ADMIN 가드로 보호하므로 일반 사용자는 403 받음.
 */
import api from './api';

/**
 * 전체 대화 목록 페이지.
 *
 * @param {object} params
 * @param {string} [params.q]      키워드 (빈 값이면 검색 안 함)
 * @param {string} [params.mode]   all | general | study | worklearn (기본 all)
 * @param {string} [params.period] total | today | week | month (기본 total)
 * @param {number} [params.page]   0-base 페이지 (기본 0)
 * @param {number} [params.size]   페이지 크기 (기본 20, 최대 100)
 * @returns {Promise<{items: Array, page: number, size: number, totalCount: number, totalPages: number}>}
 */
export async function listAdminConversations({ q, mode, period, page, size } = {}) {
  const { data } = await api.get('/admin/conversations', {
    params: { q: q || undefined, mode, period, page, size },
  });
  return data.data;
}

/**
 * 대화 1건 상세 — 메타 + 메시지 전체.
 *
 * @param {string} id 대화 UUID
 * @returns {Promise<{
 *   conversationId, title, mode, llm, createdAt,
 *   user: { id, name, email, role },
 *   messages: Array<{ id, role, content, createdAt }>
 * }>}
 */
export async function fetchAdminConversationDetail(id) {
  const { data } = await api.get(`/admin/conversations/${id}/messages`);
  return data.data;
}
