/** @fileoverview 앱 전역 UI 상태 관리 스토어 (LLM 선택, 모드, 사이드바, 모달) */
import { create } from 'zustand';
import useMindmapStore from './useMindmapStore';

const useAppStore = create((set) => ({
  // 현재 선택된 LLM 모델
  selectedLLM: 'gpt-4o',
  // 현재 앱 모드 (general, cert, rag 등)
  mainMode: 'general',
  // 마인드맵 패널 표시 여부
  isMindmapOn: false,
  // 사이드바 접힘 여부
  isSidebarCollapsed: false,
  // 모바일 사이드바 열림 여부
  isMobileSidebarOpen: false,

  setLLM: (llm) => set({ selectedLLM: llm }),
  setMainMode: (mode) => {
    set({ mainMode: mode });
    // 모드 전환 시 해당 모드의 마지막 마인드맵 복원
    useMindmapStore.getState().restoreForMode(mode);
  },
  toggleMindmap: () => set((state) => ({ isMindmapOn: !state.isMindmapOn })),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),

  // 현재 활성화된 모달 식별자
  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

export default useAppStore;
