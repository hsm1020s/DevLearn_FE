import { API_CONFIG } from './api.config';
import * as mock from './mock/mindmapMock';
import api from './api';

export async function saveMindmap(params) {
  if (API_CONFIG.useMock) return mock.saveMindmap(params);
  const { data } = await api.post('/mindmap/save', params);
  return data;
}

export async function getMindmapList() {
  if (API_CONFIG.useMock) return mock.getMindmapList();
  const { data } = await api.get('/mindmap/list');
  return data;
}

export async function getMindmap(id) {
  if (API_CONFIG.useMock) return mock.getMindmap(id);
  const { data } = await api.get(`/mindmap/${id}`);
  return data;
}
