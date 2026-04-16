/**
 * @fileoverview 범용 유틸리티 헬퍼 함수 모음
 */

/** 고유 UUID를 생성하여 반환한다. (비보안 컨텍스트 HTTP+IP 접속 대응) */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 비보안 컨텍스트 폴백: crypto.getRandomValues 기반 UUID v4
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

