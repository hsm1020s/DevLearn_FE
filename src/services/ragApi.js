import { API_CONFIG } from './api.config';
import * as mock from './mock/ragMock';
import api from './api';

export async function uploadDocument(file) {
  if (API_CONFIG.useMock) return mock.uploadDocument(file);
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/rag/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function queryRag(params) {
  if (API_CONFIG.useMock) return mock.queryRag(params);
  const { data } = await api.post('/rag/query', params);
  return data;
}

export async function getSource(chunkId) {
  if (API_CONFIG.useMock) return mock.getSource(chunkId);
  const { data } = await api.get(`/rag/source/${chunkId}`);
  return data;
}

export async function deleteDocument(docId) {
  if (API_CONFIG.useMock) return mock.deleteDocument(docId);
  const { data } = await api.delete(`/rag/docs/${docId}`);
  return data;
}
