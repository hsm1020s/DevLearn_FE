/**
 * @fileoverview 에러 메시지 변환 및 토스트 알림 표시를 담당하는 에러 처리 유틸리티
 */

import { useToastStore } from '../components/common/Toast';

// 에러 유형별 사용자 노출 메시지
const ERROR_MESSAGES = {
  NETWORK: '네트워크 연결을 확인해주세요',
  TIMEOUT: '요청 시간이 초과되었습니다',
  SERVER: '서버 오류가 발생했습니다',
  DEFAULT: '요청에 실패했습니다',
};

/** 에러 객체를 분석하여 사용자에게 보여줄 메시지를 반환한다. */
export function getErrorMessage(error) {
  if (!error) return ERROR_MESSAGES.DEFAULT;
  if (error.code === 'ERR_NETWORK') return ERROR_MESSAGES.NETWORK;
  if (error.code === 'ECONNABORTED') return ERROR_MESSAGES.TIMEOUT;
  if (error.response?.status >= 500) return ERROR_MESSAGES.SERVER;
  return error.userMessage || error.message || ERROR_MESSAGES.DEFAULT;
}

/** 에러 토스트 알림을 표시한다. fallbackMessage가 있으면 우선 사용한다. */
export function showError(error, fallbackMessage) {
  const message = fallbackMessage || getErrorMessage(error);
  useToastStore.getState().addToast(message, 'error');
}

/** 성공 토스트 알림을 표시한다. */
export function showSuccess(message) {
  useToastStore.getState().addToast(message, 'success');
}
