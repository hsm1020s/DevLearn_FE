/**
 * @fileoverview 사용자별 로컬 스토어 일괄 초기화 유틸.
 *
 * 로그아웃 시(또는 앱 부팅 시 비로그인 상태 확인 시) 호출하여,
 * 이전 세션의 대화/마인드맵/학습 데이터가 다음 사용자에게
 * 노출되지 않도록 한다. 각 스토어의 `reset()`이 in-memory 상태를 비우고,
 * `localStorage` 키까지 직접 제거해 persist 다음 write 전에도 잔여 데이터가
 * 남지 않도록 보장한다.
 *
 * 주의: auth 스토어는 여기서 건드리지 않는다(로그인/로그아웃 자체가 auth 책임).
 */
import useChatStore from '../stores/useChatStore';
import useMindmapStore from '../stores/useMindmapStore';
import useStudyStore from '../stores/useStudyStore';

/** persist 키 목록 — 각 스토어의 `name` 옵션과 일치해야 함 */
const USER_STORE_KEYS = [
  'chat-store',
  'doc-store', // 과거 useDocStore persist 잔여값이 있을 수 있어 함께 정리
  'mindmap-store',
  'study-store',
  'worklearn-store', // 과거 useWorkLearnStore persist 잔여값 정리용 (스토어는 제거됨)
];

/** 사용자별 로컬 상태와 localStorage 캐시를 모두 초기화한다. */
export function resetUserStores() {
  useChatStore.getState().reset();
  useMindmapStore.getState().reset();
  useStudyStore.getState().reset();
  for (const key of USER_STORE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Safari private 모드 등 스토리지 접근 실패 시 무시 */
    }
  }
}
