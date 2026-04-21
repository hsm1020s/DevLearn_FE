/** @fileoverview 앱 전역 UI 상태 관리 스토어 (LLM 선택, 모드, 사이드바, 모달, 분할 비율) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useMindmapStore from './useMindmapStore';
import useChatStore from './useChatStore';

const SPLIT_MIN = 20;
const SPLIT_MAX = 80;

const useAppStore = create(
  persist(
    (set) => ({
      // 현재 선택된 LLM 모델
      selectedLLM: 'gpt-4o',
      // 현재 앱 모드 (general, study)
      mainMode: 'general',
      // 마인드맵 패널 표시 여부
      isMindmapOn: false,
      // 사이드바 접힘 여부
      isSidebarCollapsed: false,
      // 모바일 사이드바 열림 여부
      isMobileSidebarOpen: false,
      // 채팅/마인드맵 분할 시 좌측(채팅) 비율 (%)
      splitLeftPct: 50,

      setLLM: (llm) => set({ selectedLLM: llm }),
      setMainMode: (mode) => {
        set({ mainMode: mode });
        // 모드 전환 시 채팅 공간을 모드별로 분리하고 마인드맵도 복원
        useChatStore.getState().switchMode(mode);
        useMindmapStore.getState().restoreForMode(mode);
      },
      toggleMindmap: () => set((state) => ({ isMindmapOn: !state.isMindmapOn })),
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
      // 20~80% 범위로 클램프하여 한쪽이 사라지지 않도록 방지
      setSplitLeftPct: (pct) => {
        const clamped = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
        set({ splitLeftPct: clamped });
      },

      // 현재 활성화된 모달 식별자
      activeModal: null,
      setActiveModal: (modal) => set({ activeModal: modal }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'app-store',
      // ephemeral UI 상태(모달, 모바일 드로어)는 저장하지 않고 사용자 선호만 보존.
      // mainMode/isMindmapOn은 새로고침 후에도 직전 세션을 이어가도록 저장.
      partialize: (state) => ({
        splitLeftPct: state.splitLeftPct,
        mainMode: state.mainMode,
        isMindmapOn: state.isMindmapOn,
      }),
    },
  ),
);

export default useAppStore;
