/**
 * @fileoverview 학습 모드 상태 관리 스토어 (학습 채팅 전용 슬림 버전).
 *
 * 과거에는 PDF 업로드·퀴즈 세션·오답 노트·통계 누적 등 다목적 데이터를
 * subjects 축으로 네임스페이스 분리해 관리했지만, 퀴즈/기록 기능이 제거되면서
 * 다음 4개 글로벌 필드만 남았다:
 *   - chatStyle / chatStyleLocked      : 학습 채팅 스타일 칩(일반/파인만)
 *   - feynmanDocId / feynmanChapter    : 파인만 대화형 학습 세션 식별자
 *
 * persist 마이그레이션은 v8에서 옛 subjects 버킷·퀴즈/오답/통계 필드를 모두 폐기한다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStudyStore = create(
  persist(
    (set, get) => ({
      // 학습 채팅 스타일 — 일반/파인만 칩으로 다음 턴에 적용할 프리셋
      chatStyle: 'general',
      // 📌 고정 토글 — true면 턴이 끝나도 chatStyle을 'general'로 자동 리셋하지 않음
      chatStyleLocked: false,

      // 파인만 대화형 학습 — 선택된 챕터/문서 (null이면 비활성)
      feynmanDocId: null,
      feynmanChapter: null,

      // ────────── 채팅 스타일 ──────────
      setChatStyle: (style) => set({ chatStyle: style }),
      setChatStyleLocked: (locked) => set({ chatStyleLocked: locked }),
      /** 턴 종료 후 호출. 📌 고정 상태가 아니면 'general'로 자동 복귀. */
      resetChatStyleIfNotLocked: () => {
        if (!get().chatStyleLocked) set({ chatStyle: 'general' });
      },

      // ────────── 파인만 세션 ──────────
      /** 파인만 대화형 학습 챕터 선택. */
      setFeynmanSession: (docId, chapter) => set({ feynmanDocId: docId, feynmanChapter: chapter }),
      /** 파인만 세션 종료 — 챕터 선택 해제. */
      clearFeynmanSession: () => set({ feynmanDocId: null, feynmanChapter: null }),

      // ────────── 전체 리셋 ──────────
      /** 로그아웃 시 호출 — 학습 채팅 관련 상태 전부 초기화. */
      reset: () =>
        set({
          chatStyle: 'general',
          chatStyleLocked: false,
          feynmanDocId: null,
          feynmanChapter: null,
        }),
    }),
    {
      name: 'study-store',
      version: 8,
      /**
       * 마이그레이션 히스토리:
       * - v1~v7: PDF 문서·퀴즈 세션·오답·통계를 subjects 축으로 네임스페이스 분리해 관리.
       *   v3에서 subjects 도입, v4에서 'eng' 과목 드롭, v5/v7에서 stats.byType 정리,
       *   v6에서 체크리스트 드롭.
       * - v8: 퀴즈/기록 기능 제거 — subjects 버킷·activeSubject·모든 퀴즈/오답/통계
       *   필드 폐기. 학습 채팅 4개 글로벌 필드만 남긴다. 사용자 오답·통계 데이터는 영구 소실.
       */
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
        if (version < 8) {
          return {
            chatStyle: 'general',
            chatStyleLocked: persisted.chatStyleLocked ?? false,
            feynmanDocId: null,
            feynmanChapter: null,
          };
        }
        return persisted;
      },
      partialize: (state) => ({
        chatStyle: state.chatStyle,
        chatStyleLocked: state.chatStyleLocked,
        feynmanDocId: state.feynmanDocId,
        feynmanChapter: state.feynmanChapter,
      }),
    },
  ),
);

export default useStudyStore;
