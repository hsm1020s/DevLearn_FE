import { API_CONFIG } from './api.config';
import * as mock from './mock/certMock';
import api from './api';

export async function uploadPdf(file) {
  if (API_CONFIG.useMock) return mock.uploadPdf(file);
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/cert/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function generateQuiz(params) {
  if (API_CONFIG.useMock) return mock.generateQuiz(params);
  const { data } = await api.post('/cert/generate-quiz', params);
  return data;
}

export async function submitAnswer(params) {
  if (API_CONFIG.useMock) return mock.submitAnswer(params);
  const { data } = await api.post('/cert/submit', params);
  return data;
}
