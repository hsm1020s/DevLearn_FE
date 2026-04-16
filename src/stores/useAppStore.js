import { create } from 'zustand';

const useAppStore = create((set) => ({
  selectedLLM: 'gpt-4o',
  mainMode: 'general',
  isMindmapOn: false,
  isSidebarCollapsed: false,

  setLLM: (llm) => set({ selectedLLM: llm }),
  setMainMode: (mode) => set({ mainMode: mode }),
  toggleMindmap: () => set((state) => ({ isMindmapOn: !state.isMindmapOn })),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

export default useAppStore;
