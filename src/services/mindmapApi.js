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
  return data;
}

/** 저장된 마인드맵 목록을 조회한다 */
export async function getMindmapList() {
  if (API_CONFIG.useMock) return mock.getMindmapList();
  const { data } = await api.get('/mindmap/list');
  return data;
}

/** ID로 특정 마인드맵을 조회한다 */
export async function getMindmap(id) {
  if (API_CONFIG.useMock) return mock.getMindmap(id);
  const { data } = await api.get(`/mindmap/${id}`);
  return data;
}
