/**
 * @fileoverview LLM 사용량 합계 store — 채팅 화면 상단 UsageBar 가 구독.
 *
 * BE 의 진실(llm_call_logs 집계)을 그대로 표시하므로 persist 하지 않는다 — localStorage 캐시는
 * stale 위험이 크고, 사용량은 새로고침마다 BE 한 번 받으면 충분.
 *
 * 호출 흐름:
 *  - ChatUsageBar 마운트 시 1회 `refresh()` (이미 summary 있으면 그대로 두고 스킵하지 않음 — 새 마운트는 새 화면이라 최신화)
 *  - 채팅/파인만 스트림 종료 직후 `useUsageStore.getState().refresh()`
 *
 * 실패 시 summary 는 null 로 유지 — UI 는 자리표시자("—") 만 노출하고 깨지지 않음.
 */
import { create } from 'zustand';
import { getUsageSummary } from '../services/usageApi';

const useUsageStore = create((set, get) => ({
  /**
   * BE 응답 그대로:
   * { today: { inputTokens, outputTokens, costUsd, costKrw },
   *   week:  { ... },
   *   month: { ... },
   *   krwPerUsd: number }
   * 또는 미로드/실패 시 null.
   */
  summary: null,

  /** fetch 진행 중 플래그 (중복 호출 방지) */
  loading: false,

  /** 마지막 fetch 시각 — 디버깅용 */
  lastFetchedAt: null,

  /** 사용량 갱신. 동시 호출 방지를 위해 loading 중이면 skip. */
  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const summary = await getUsageSummary();
      set({ summary, loading: false, lastFetchedAt: Date.now() });
    } catch (err) {
      // 인증 만료/네트워크 실패 등 — UI 에는 자리표시자 유지
      set({ loading: false });
    }
  },

  /** 로그아웃 시 초기화 (선택, 외부에서 명시 호출) */
  reset: () => set({ summary: null, loading: false, lastFetchedAt: null }),
}));

export default useUsageStore;
