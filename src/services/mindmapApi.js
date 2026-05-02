/**
 * @fileoverview 마인드맵 API - 마인드맵 저장, 목록 조회, 개별 조회 처리
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/mindmapMock';
import api from './api';

/** 마인드맵 데이터를 서버에 저장한다 */
export async function saveMindmap(params) {
  if (API_CONFIG.useMock) return mock.saveMindmap(params);
  const { data } = await api.post('/mindmap/save', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 저장된 마인드맵 목록을 조회한다 */
export async function getMindmapList() {
  if (API_CONFIG.useMock) return mock.getMindmapList();
  const { data } = await api.get('/mindmap/list');
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** ID로 특정 마인드맵을 조회한다 */
export async function getMindmap(id) {
  if (API_CONFIG.useMock) return mock.getMindmap(id);
  const { data } = await api.get(`/mindmap/${id}`);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 마인드맵을 서버에서 삭제한다 */
export async function deleteMindmap(id) {
  if (API_CONFIG.useMock) return mock.deleteMindmap(id);
  const { data } = await api.delete(`/mindmap/${id}`);
  // 백엔드 ApiResponse 래핑 해제 (본문이 없으면 undefined 반환)
  return data?.data;
}

/**
 * 여러 마인드맵을 한 번에 soft 삭제한다 (체크박스 일괄 삭제 UI 용).
 * @param {string[]} ids - 삭제할 마인드맵 ID 목록
 * @returns {Promise<{ deletedCount: number }>} 실제로 삭제된 행 수
 */
export async function deleteMindmapsBatch(ids) {
  if (API_CONFIG.useMock) return mock.deleteMindmapsBatch(ids);
  const { data } = await api.post('/mindmap/delete-batch', { ids });
  return data.data;
}

/**
 * soft 삭제된 마인드맵을 복구한다 (deleted_at = NULL).
 * "자동 생성" 탭에서 [보기] 클릭 시 항상 호출 (멱등 — 이미 살아있어도 안전).
 * @param {string} id
 */
export async function restoreMindmap(id) {
  if (API_CONFIG.useMock) return; // mock 은 hard delete 라 복구 개념 없음 — no-op
  await api.post(`/mindmap/${id}/restore`);
}
