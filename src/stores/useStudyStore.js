/**
 * @fileoverview 학습 모드 상태 관리 스토어 (학습 채팅 전용).
 *
 * 글로벌 필드:
 *   - chatStyle / chatStyleLocked     : 학습 채팅 스타일 칩(일반/파인만)
 *
 * 모드별(study/worklearn) 필드:
 *   - feynmanByMode[mode].docId       : 파인만 학습 대상 문서 id
 *   - feynmanByMode[mode].chapter     : 파인만 학습 대상 챕터
 *
 * 파인만 세션을 모드별로 분리한 이유: 공부 모드의 챕터 선택이 업무학습 모드로
 * 새어 나가지 않도록 하기 위함. 모드 전환 시 각 모드의 마지막 챕터 선택이 보존된다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 모드별 파인만 세션 슬롯의 빈 상태. */
const emptyFeynmanSlot = () => ({ docId: null, chapter: null });

/** 모드 키가 study/worklearn이 아니면 study로 폴백 (방어적). */
const normalizeMode = (mode) => (mode === 'worklearn' ? 'worklearn' : 'study');

const useStudyStore = create(
  persist(
    (set, get) => ({
      // 학습 채팅 스타일 — 일반/파인만 칩으로 다음 턴에 적용할 프리셋 (모드 무관)
      chatStyle: 'general',
      // 📌 고정 토글 — true면 턴이 끝나도 chatStyle을 'general'로 자동 리셋하지 않음
      chatStyleLocked: false,

      // 파인만 대화형 학습 — 모드별 슬롯
      feynmanByMode: {
        study: emptyFeynmanSlot(),
        worklearn: emptyFeynmanSlot(),
      },

      // ────────── 채팅 스타일 ──────────
      setChatStyle: (style) => set({ chatStyle: style }),
      setChatStyleLocked: (locked) => set({ chatStyleLocked: locked }),
      /** 턴 종료 후 호출. 📌 고정 상태가 아니면 'general'로 자동 복귀. */
      resetChatStyleIfNotLocked: () => {
        if (!get().chatStyleLocked) set({ chatStyle: 'general' });
      },

      // ────────── 파인만 세션 (모드별) ──────────
      /**
       * 파인만 대화형 학습 챕터 선택.
       * @param {'study'|'worklearn'} mode
       */
      setFeynmanSession: (mode, docId, chapter) => {
        const m = normalizeMode(mode);
        set((state) => ({
          feynmanByMode: {
            ...state.feynmanByMode,
            [m]: { docId, chapter },
          },
        }));
      },
      /** 파인만 세션 종료 — 해당 모드 슬롯만 해제. */
      clearFeynmanSession: (mode) => {
        const m = normalizeMode(mode);
        set((state) => ({
          feynmanByMode: {
            ...state.feynmanByMode,
            [m]: emptyFeynmanSlot(),
          },
        }));
      },
      /** getState() 폴백 경로용 헬퍼 — 셀렉터 형태가 아니라 즉시 값. */
      getFeynmanSession: (mode) => {
        const m = normalizeMode(mode);
        return get().feynmanByMode[m] ?? emptyFeynmanSlot();
      },

      // ────────── 전체 리셋 ──────────
      /** 로그아웃 시 호출 — 학습 채팅 관련 상태 전부 초기화. */
      reset: () =>
        set({
          chatStyle: 'general',
          chatStyleLocked: false,
          feynmanByMode: {
            study: emptyFeynmanSlot(),
            worklearn: emptyFeynmanSlot(),
          },
        }),
    }),
    {
      name: 'study-store',
      version: 9,
      /**
       * 마이그레이션 히스토리:
       * - v1~v7: PDF 문서·퀴즈 세션·오답·통계를 subjects 축으로 관리.
       * - v8: 퀴즈/기록 기능 제거 — chat/feynman 4필드 글로벌만 보존.
       * - v9: 파인만 세션을 모드별(study/worklearn) 네임스페이스로 분리.
       *   글로벌 feynmanDocId/Chapter가 있으면 study 슬롯으로 이관, worklearn은 빈 슬롯.
       */
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
        if (version < 8) {
          return {
            chatStyle: 'general',
            chatStyleLocked: persisted.chatStyleLocked ?? false,
            feynmanByMode: {
              study: emptyFeynmanSlot(),
              worklearn: emptyFeynmanSlot(),
            },
          };
        }
        if (version < 9) {
          // v8 글로벌 슬롯 → study 슬롯으로 이관 (사용자가 마지막에 보던 챕터 보존)
          const docId = persisted.feynmanDocId ?? null;
          const chapter = persisted.feynmanChapter ?? null;
          return {
            chatStyle: persisted.chatStyle ?? 'general',
            chatStyleLocked: persisted.chatStyleLocked ?? false,
            feynmanByMode: {
              study: { docId, chapter },
              worklearn: emptyFeynmanSlot(),
            },
          };
        }
        return persisted;
      },
      partialize: (state) => ({
        chatStyle: state.chatStyle,
        chatStyleLocked: state.chatStyleLocked,
        feynmanByMode: state.feynmanByMode,
      }),
    },
  ),
);

export default useStudyStore;
