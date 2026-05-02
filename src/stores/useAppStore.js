/** @fileoverview 앱 전역 UI 상태 관리 스토어 (LLM 선택, 모드, 사이드바, 모달, 분할 비율) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useMindmapStore from './useMindmapStore';
import useChatStore from './useChatStore';

const SPLIT_MIN = 20;
const SPLIT_MAX = 80;

// surface 알파값 범위. 0.4 미만은 패널이 body 톤에 거의 묻혀 가독성이 무너지므로 하한.
const CLARITY_MIN = 0.4;
const CLARITY_MAX = 1.0;

// 임시 단계 비밀번호. TODO: prod 전환 시 환경변수 또는 서버 검증으로 교체.
const TEMP_UNLOCK_PASSWORD = '12345';

const useAppStore = create(
  persist(
    (set) => ({
      // 현재 선택된 LLM 모델 (초기값은 가성비 티어의 Claude Haiku 4.5)
      selectedLLM: 'claude-haiku-4-5',
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
      // 학습 워크스페이스 좌우 분할 시 좌측(일반 채팅) 비율 (%) — 마인드맵 분할과 독립
      learningSplitLeftPct: 50,
      // 화면 선명도 (surface 알파값). 1.0=선명, 0.4=흐림.
      uiClarity: 1.0,
      // 선명도가 한 번이라도 최저값(CLARITY_MIN)에 닿으면 잠겨서, 임시 비밀번호 없이는 다시 올릴 수 없다.
      // 자리비움 시 옆 사람이 슬라이더만 올려서 화면을 훔쳐보는 것을 막는 잠금.
      clarityLocked: false,

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
      // 학습 워크스페이스 분할 비율 setter — 같은 클램프 정책 사용
      setLearningSplitLeftPct: (pct) => {
        const clamped = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
        set({ learningSplitLeftPct: clamped });
      },
      setUiClarity: (v) => {
        const clamped = Math.min(CLARITY_MAX, Math.max(CLARITY_MIN, v));
        const state = useAppStore.getState();
        // 잠긴 상태에서 더 선명하게(=값을 키우는) 시도는 조용히 거부.
        // UI 측에서 비밀번호 팝오버를 띄우는 흐름이 정석이고, 스토어는 최후 가드.
        if (state.clarityLocked && clamped > state.uiClarity) return;
        // 잠기지 않은 상태에서 최저값에 닿으면 잠금 활성화.
        const shouldLock = !state.clarityLocked && clamped <= CLARITY_MIN;
        set(shouldLock ? { uiClarity: clamped, clarityLocked: true } : { uiClarity: clamped });
      },
      // 임시 비밀번호로 잠금 해제. 일치하면 true, 아니면 false 반환.
      // 통과 시 선명도까지 최대로 복원 — 자리비움에서 돌아온 사용자가 슬라이더를 다시 끌어올릴 필요 없음.
      unlockClarityWithPassword: (pw) => {
        if (pw === TEMP_UNLOCK_PASSWORD) {
          set({ clarityLocked: false, uiClarity: CLARITY_MAX });
          return true;
        }
        return false;
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
        learningSplitLeftPct: state.learningSplitLeftPct,
        mainMode: state.mainMode,
        isMindmapOn: state.isMindmapOn,
        uiClarity: state.uiClarity,
        // 잠금 상태도 보존해야 자리비움 → 새로고침 시나리오에서 보호 의미가 유지된다.
        clarityLocked: state.clarityLocked,
      }),
    },
  ),
);

export default useAppStore;
