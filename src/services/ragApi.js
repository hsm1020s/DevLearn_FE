/**
 * @fileoverview RAG API - 문서 업로드, 질의응답, 원문 조회, 문서 삭제 처리
 */
import { API_CONFIG } from './api.config';
import * as mock from './mock/ragMock';
import api from './api';

/** RAG용 문서 파일을 업로드하고 청크 분할 결과를 반환한다 */
export async function uploadDocument(file) {
  if (API_CONFIG.useMock) return mock.uploadDocument(file);
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/rag/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 문서 기반 RAG 질의를 수행하고 답변과 출처를 반환한다 */
export async function queryRag(params) {
  if (API_CONFIG.useMock) return mock.queryRag(params);
  const { data } = await api.post('/rag/query', params);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 특정 청크의 원문 텍스트를 조회한다 */
export async function getSource(chunkId) {
  if (API_CONFIG.useMock) return mock.getSource(chunkId);
  const { data } = await api.get(`/rag/source/${chunkId}`);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}

/** 업로드된 문서를 삭제한다 */
export async function deleteDocument(docId) {
  if (API_CONFIG.useMock) return mock.deleteDocument(docId);
  const { data } = await api.delete(`/rag/docs/${docId}`);
  // 백엔드 ApiResponse 래핑 해제
  return data.data;
}
