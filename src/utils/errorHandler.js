/**
 * @fileoverview 에러 메시지 추출 및 토스트 노출 유틸.
 *
 * 백엔드 `ApiResponse`(`{success:false, message, errorCode}`)의 `message`/`errorCode`를
 * 토스트에 그대로 노출해 사용자가 "왜 안 되는지" 즉시 파악할 수 있게 한다.
 * 호출부가 넘긴 컨텍스트 라벨은 토스트의 **제목**으로, 백엔드 메시지는 **본문**으로
 * 분리 표시되며, errorCode는 작은 칩으로 노출된다.
 */

import { useToastStore } from '../components/common/Toast';

/** 네트워크/타임아웃 상위 메시지 — 백엔드 응답이 없을 때만 사용. */
const TRANSPORT_MESSAGES = {
  ERR_NETWORK: '네트워크 연결을 확인해주세요',
  ECONNABORTED: '요청 시간이 초과되었습니다',
};

/**
 * 에러 객체에서 사용자 노출용 메시지를 추출한다.
 * 우선순위: 백엔드 message > axios 인터셉터가 첨부한 userMessage > error.message > null.
 * @param {*} error
 * @returns {string|null}
 */
export function extractBackendMessage(error) {
  if (!error) return null;
  const transport = TRANSPORT_MESSAGES[error.code];
  if (transport) return transport;
  return (
    error.response?.data?.message ||
    error.userMessage ||
    error.message ||
    null
  );
}

/**
 * 백엔드가 내려준 errorCode를 추출한다(있으면). 디버깅·필터링용으로 토스트 우측에 노출.
 * @param {*} error
 * @returns {string|null}
 */
export function extractErrorCode(error) {
  if (!error) return null;
  return error.response?.data?.errorCode || null;
}

/**
 * 에러 토스트를 노출한다.
 *
 * - error + contextLabel 모두 있음 → 제목(컨텍스트) + 본문(백엔드 메시지) + 코드 칩
 * - error만 있음 → 본문(백엔드 메시지) + 코드 칩
 * - error 없고 contextLabel만 있음 → 본문(컨텍스트) (클라이언트 검증 패턴)
 * - 둘 다 없음 → 기본 메시지 폴백
 *
 * @param {*} error 에러 객체 (axios error / Error / null)
 * @param {string} [contextLabel] 어떤 동작이 실패했는지 알려주는 컨텍스트 라벨
 */
export function showError(error, contextLabel) {
  const backendMsg = extractBackendMessage(error);
  const code = extractErrorCode(error);

  let payload;
  if (error && contextLabel) {
    payload = { title: contextLabel, body: backendMsg || '요청에 실패했습니다', code };
  } else if (error) {
    payload = { body: backendMsg || '요청에 실패했습니다', code };
  } else if (contextLabel) {
    payload = { body: contextLabel };
  } else {
    payload = { body: '요청에 실패했습니다' };
  }

  useToastStore.getState().addToast(payload, 'error');
}

/** 성공 토스트. 단일 라인. */
export function showSuccess(message) {
  useToastStore.getState().addToast(message, 'success');
}
