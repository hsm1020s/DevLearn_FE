import { useToastStore } from '../components/common/Toast';

const ERROR_MESSAGES = {
  NETWORK: '네트워크 연결을 확인해주세요',
  TIMEOUT: '요청 시간이 초과되었습니다',
  SERVER: '서버 오류가 발생했습니다',
  DEFAULT: '요청에 실패했습니다',
};

export function getErrorMessage(error) {
  if (!error) return ERROR_MESSAGES.DEFAULT;
  if (error.code === 'ERR_NETWORK') return ERROR_MESSAGES.NETWORK;
  if (error.code === 'ECONNABORTED') return ERROR_MESSAGES.TIMEOUT;
  if (error.response?.status >= 500) return ERROR_MESSAGES.SERVER;
  return error.userMessage || error.message || ERROR_MESSAGES.DEFAULT;
}

export function showError(error, fallbackMessage) {
  const message = fallbackMessage || getErrorMessage(error);
  useToastStore.getState().addToast(message, 'error');
}

export function showSuccess(message) {
  useToastStore.getState().addToast(message, 'success');
}
