/**
 * @fileoverview 범용 유틸리티 헬퍼 함수 모음
 */

/** 고유 UUID를 생성하여 반환한다. */
export function generateId() {
  return crypto.randomUUID();
}

