/**
 * @fileoverview 학습 모드 상태 관리 스토어 (subject 축 네임스페이스 버전).
 *
 * 학습 모드는 컨테이너이고, 과목(subject)은 그 안의 네임스페이스다.
 * 오답노트·체크리스트·통계·문서·현재 퀴즈 세션은 `subjects[id]` 버킷 안에서
 * 과목별로 격리 관리되고, 채팅 스타일·스타일 고정 여부만 과목 공유 전역 상태로
 * 남겨둔다.
 *
 * 액션들은 명시적으로 subject id를 받지 않는다 — 기본적으로 **현재 activeSubject**
 * 에 대해 동작한다. 필요한 경우에만 id를 파라미터로 노출한다(setActiveSubject 등).
 *
 * persist v2 → v3 마이그레이션: 기존 루트 필드는 `subjects.custom` 버킷으로 이동
 * 해 데이터 손실 없이 과목 축 구조로 흡수된다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import {
  SUBJECT_CATALOG,
  SUBJECT_LIST,
  DEFAULT_SUBJECT_ID,
  getSubject,
} from '../registry/subjects';

/** 과목 버킷 하나의 빈 상태. 과목 스위칭 시 이 shape로 초기화된다. */
const emptySubjectState = () => ({
  studyDocs: [],
  currentQuiz: null,
  currentQuestionIndex: 0,
  answers: {},
  studyStep: 'settings',
  quizPaused: false,
  quizSeed: null,
  quizTimerSec: null,
  wrongAnswers: [],
  checklist: [],
  stats: {
    totalSolved: 0,
    correctCount: 0,
    byDifficulty: { easy: 0, mixed: 0, hard: 0 },
    byType: { multiple: 0, ox: 0, short: 0 },
  },
});

/** 레지스트리 기반 초기 과목 버킷 세트 — 각 과목의 기본 체크리스트를 시드로 주입한다. */
const initialSubjects = () => {
  const out = {};
  for (const s of SUBJECT_LIST) {
    out[s.id] = {
      ...emptySubjectState(),
      // 카탈로그 체크리스트는 참조 공유를 피하기 위해 깊은 복사
      checklist: JSON.parse(JSON.stringify(s.checklist || [])),
    };
  }
  return out;
};

/** 활성 과목 버킷 하나만 패치하는 얕은 업데이트 헬퍼. */
function patchActive(state, patch) {
  const id = state.activeSubject;
  return {
    subjects: {
      ...state.subjects,
      [id]: { ...state.subjects[id], ...patch },
    },
  };
}

const useStudyStore = create(
  persist(
    (set, get) => ({
      // 현재 활성 과목 — 컴포넌트는 이 값을 따라 자신이 볼 버킷을 결정한다
      activeSubject: DEFAULT_SUBJECT_ID,
      // 과목별 세션 네임스페이스
      subjects: initialSubjects(),

      // 채팅 스타일은 과목 공유 전역 (학습 모드 어디서든 동일)
      chatStyle: 'general',
      chatStyleLocked: false,

      /** 활성 과목 전환. 유효하지 않은 id면 무시. */
      setActiveSubject: (subjectId) => {
        if (!get().subjects[subjectId]) return;
        set({ activeSubject: subjectId });
      },

      /** (셀렉터) 현재 활성 과목 버킷 — 외부에서도 재사용. */
      getActiveSubjectState: () => {
        const s = get();
        return s.subjects[s.activeSubject];
      },

      // ────────── 문서 ──────────
      /** 새 문서를 활성 과목에 추가. */
      addDoc: (doc) => {
        const newDoc = { id: generateId(), status: 'processing', progress: 0, ...doc };
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, { studyDocs: [...active.studyDocs, newDoc] });
        });
        return newDoc;
      },

      updateDocStatus: (id, status, progress) =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, {
            studyDocs: active.studyDocs.map((d) =>
              d.id === id ? { ...d, status, progress } : d,
            ),
          });
        }),

      removeDoc: (id) =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, {
            studyDocs: active.studyDocs.filter((d) => d.id !== id),
          });
        }),

      // ────────── 퀴즈 세션 ──────────
      /** 활성 과목의 퀴즈 단계 이동 (settings ↔ quiz ↔ result). */
      setStudyStep: (step) => set((state) => patchActive(state, { studyStep: step })),

      /** 퀴즈 세션 세팅 — 진행 상태/답안/일시정지/타이머 일괄 초기화. */
      setQuiz: (quiz, options = {}) =>
        set((state) =>
          patchActive(state, {
            currentQuiz: quiz,
            currentQuestionIndex: 0,
            answers: {},
            quizPaused: false,
            quizTimerSec: options.timerSec ?? null,
          }),
        ),

      /** 문제 이동. 이미 답한 문제로 돌아가면 QuizPlayer가 저장된 결과를 복원한다. */
      setQuestionIndex: (index) => set((state) => patchActive(state, { currentQuestionIndex: index })),

      /** 특정 문제 답안 저장 — 채점 결과(correct/explanation/correctAnswer 포함)를 통째로 보관. */
      submitAnswer: (questionId, answer) =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, {
            answers: { ...active.answers, [questionId]: answer },
          });
        }),

      /** 탭 이동·수동 토글 시 호출. 타이머 감소와 선택지 클릭이 이 플래그에 의해 막힌다. */
      setQuizPaused: (paused) => set((state) => patchActive(state, { quizPaused: paused })),

      /** 모의고사 타이머 1초 감소. paused이거나 null이면 no-op. */
      tickQuizTimer: () =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          if (active.quizTimerSec === null || active.quizPaused) return {};
          return patchActive(state, {
            quizTimerSec: Math.max(0, active.quizTimerSec - 1),
          });
        }),

      /** 퀴즈 세션 리셋 — 설정 단계로 복귀. */
      resetQuiz: () =>
        set((state) =>
          patchActive(state, {
            currentQuiz: null,
            currentQuestionIndex: 0,
            answers: {},
            studyStep: 'settings',
            quizPaused: false,
            quizTimerSec: null,
            quizSeed: null,
          }),
        ),

      /**
       * 오답노트 → 퀴즈 재출제 seed 저장. StudyQuizTab의 useEffect가 seed를 감지해
       * 새 세션(seed 문제 + 보조 4문제)을 생성한다 (액티브 리콜 전략).
       */
      setQuizSeed: (seed) => set((state) => patchActive(state, { quizSeed: seed })),
      clearQuizSeed: () => set((state) => patchActive(state, { quizSeed: null })),

      // ────────── 채팅 스타일 (전역) ──────────
      // 스타일은 과목 전환과 무관해야 하므로 subjects 밖 루트 필드로 둔다.
      setChatStyle: (style) => set({ chatStyle: style }),
      setChatStyleLocked: (locked) => set({ chatStyleLocked: locked }),
      /** 턴 종료 후 호출. 📌 고정 상태가 아니면 'general'로 자동 복귀. */
      resetChatStyleIfNotLocked: () => {
        if (!get().chatStyleLocked) set({ chatStyle: 'general' });
      },

      // ────────── 오답노트 / 통계 ──────────
      /**
       * 퀴즈 완료 시 오답 묶음을 활성 과목 오답노트에 누적 + 통계 반영.
       * quiz/answers는 세션 로컬 값이므로 외부에서 주입받는다.
       */
      addWrongAnswersFromSession: ({ quiz, answers: sessionAnswers }) => {
        if (!quiz) return;
        const questions = quiz.questions || [];
        const wrongs = questions
          .filter((q) => {
            const a = sessionAnswers[q.id];
            return a && a.correct === false;
          })
          .map((q) => {
            const a = sessionAnswers[q.id];
            return {
              id: generateId(),
              quizId: quiz.quizId || 'local-quiz',
              // 과목 집계 연계를 위해 문제의 part 태그를 오답 엔트리에도 보존(optional).
              // 나중에 "과목별 오답 필터" 등에 사용.
              part: q.part,
              question: q.question,
              options: q.options || [],
              correctAnswer: a?.correctAnswer ?? q.correctAnswer,
              userAnswer: a?.selected,
              explanation: a?.explanation ?? q.explanation ?? '',
              difficulty: q.difficulty || quiz.difficulty || 'mixed',
              type: q.type || 'multiple',
              createdAt: new Date().toISOString(),
            };
          });

        const solvedQs = questions.filter((q) => sessionAnswers[q.id]);
        const correctQs = solvedQs.filter((q) => sessionAnswers[q.id]?.correct);

        set((state) => {
          const active = state.subjects[state.activeSubject];
          const s = active.stats;
          const nextByDiff = { ...s.byDifficulty };
          const nextByType = { ...s.byType };
          solvedQs.forEach((q) => {
            const d = q.difficulty || quiz.difficulty || 'mixed';
            const t = q.type || 'multiple';
            nextByDiff[d] = (nextByDiff[d] || 0) + 1;
            nextByType[t] = (nextByType[t] || 0) + 1;
          });
          return patchActive(state, {
            wrongAnswers: [...wrongs, ...active.wrongAnswers],
            stats: {
              totalSolved: s.totalSolved + solvedQs.length,
              correctCount: s.correctCount + correctQs.length,
              byDifficulty: nextByDiff,
              byType: nextByType,
            },
          });
        });
      },

      /** 오답노트에서 특정 항목 제거 (사용자가 🗑 클릭). 통계는 건드리지 않는다. */
      removeWrongAnswer: (id) =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, {
            wrongAnswers: active.wrongAnswers.filter((w) => w.id !== id),
          });
        }),

      // ────────── 체크리스트 ──────────
      /**
       * 체크리스트 챕터 완료 상태 토글. 활성 과목 기준으로만 동작한다.
       * (체크리스트는 `SUBJECT_CATALOG`의 기본 시드 + 사용자 체크 상태를 합쳐 관리)
       */
      toggleChecklistChapter: (bookId, chapterId) =>
        set((state) => {
          const active = state.subjects[state.activeSubject];
          return patchActive(state, {
            checklist: active.checklist.map((book) =>
              book.id !== bookId
                ? book
                : {
                    ...book,
                    chapters: book.chapters.map((ch) =>
                      ch.id !== chapterId ? ch : { ...ch, done: !ch.done },
                    ),
                  },
            ),
          });
        }),

      // ────────── 전체 리셋 ──────────
      /** 로그아웃 시 호출 — 과목 전부 초기화(시드 체크리스트는 재주입). */
      reset: () =>
        set({
          activeSubject: DEFAULT_SUBJECT_ID,
          subjects: initialSubjects(),
          chatStyle: 'general',
          chatStyleLocked: false,
        }),
    }),
    {
      name: 'study-store',
      version: 4,
      /**
       * 마이그레이션 히스토리:
       * - v1: `{ studyDocs }`만 persist
       * - v2: 루트에 wrongAnswers/checklist/stats/chatStyleLocked 추가
       * - v3: 과목 축 도입 — 기존 루트 필드를 `subjects.custom` 버킷으로 이동
       * - v4: 정보관리기술사(`eng`) 과목 제거 — 버킷 드롭 + activeSubject 폴백
       *
       * v2→v3에서 custom으로 옮긴 이유: 기존 사용자의 오답·체크·통계는 어느
       * 자격증 과목에 속하는지 판단할 근거가 없어 custom(사용자 정의) 버킷으로
       * 이관해 데이터 보존하되 분류는 사용자가 직접 재배치하도록 한다.
       *
       * v3→v4: 정보관리기술사는 논술형이라 현재 객관식 구조와 맞지 않아 제거.
       * subjects.eng 버킷은 드롭되고(연관 오답/체크/통계도 함께 사라짐),
       * activeSubject === 'eng' 사용자는 SQLP로 폴백된다.
       */
      migrate: (persisted, version) => {
        if (!persisted) return persisted;

        let state = persisted;

        // v<3: 루트 필드 → subjects.custom 이관
        if (version < 3) {
          const legacy = state;
          const subjects = initialSubjects();
          subjects.custom = {
            ...emptySubjectState(),
            studyDocs: legacy.studyDocs || [],
            wrongAnswers: legacy.wrongAnswers || [],
            checklist: legacy.checklist && legacy.checklist.length > 0 ? legacy.checklist : [],
            stats: legacy.stats || emptySubjectState().stats,
          };
          state = {
            activeSubject: 'custom',
            subjects,
            chatStyleLocked: legacy.chatStyleLocked ?? false,
          };
        }

        // v<4: eng 버킷 드롭 + activeSubject 폴백
        if (version < 4) {
          const nextSubjects = { ...(state.subjects || {}) };
          delete nextSubjects.eng;
          state = {
            ...state,
            subjects: nextSubjects,
            activeSubject:
              state.activeSubject === 'eng' ? DEFAULT_SUBJECT_ID : state.activeSubject,
          };
        }

        return state;
      },
      partialize: (state) => ({
        activeSubject: state.activeSubject,
        subjects: state.subjects,
        chatStyleLocked: state.chatStyleLocked,
      }),
    },
  ),
);

/** 활성 과목 버킷 상태를 반환하는 셀렉터 — 외부 컴포넌트의 반복 보일러플레이트 축소. */
export const selectActiveSubjectState = (state) => state.subjects[state.activeSubject];

/** 활성 과목 카탈로그(메타)를 반환하는 셀렉터. */
export const selectActiveSubjectMeta = (state) => getSubject(state.activeSubject);

export { SUBJECT_CATALOG, SUBJECT_LIST };
export default useStudyStore;
