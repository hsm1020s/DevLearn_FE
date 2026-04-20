/**
 * @fileoverview 관리자 대시보드 API.
 * 대시보드 지표(총계/최근 대화/문서 현황)를 서버에서 집계해 반환한다.
 * VITE_MOCK_API=true 환경에서는 mock 응답을 사용한다.
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/adminMock';
import api from './api';

/**
 * 관리자 대시보드 지표를 조회한다.
 * 백엔드 ApiResponse 래핑은 `data.data`로 언래핑한다.
 * @returns {Promise<{
 *   counts: { totalConversations:number, totalDocuments:number, totalMindmapNodes:number, totalQuizSolved:number },
 *   recentConversations: Array<{ id:string, title:string, mode:string, updatedAt:number|string }>,
 *   documents: Array<{ id:string, fileName:string, status:'completed'|'processing'|'failed'|'error' }>
 * }>}
 */
export async function getAdminDashboard() {
  if (API_CONFIG.useMock) return mock.getAdminDashboard();
  const { data } = await api.get('/admin/dashboard');
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}
