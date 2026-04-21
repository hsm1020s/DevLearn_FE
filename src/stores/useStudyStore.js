/**
 * @fileoverview 학습 모드 상태 관리 스토어.
 * 문서 업로드, 퀴즈 세션(진행/일시정지/시드 재출제), 채팅 스타일(파인만/요약),
 * 누적 오답노트, 교재 체크리스트, 누적 통계까지 학습 워크스페이스 전반을 관리한다.
 * 백엔드 연결 전이므로 일부는 목업 시드 데이터를 초기값으로 제공한다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

// 체크리스트 초기 시드 — 화면 확인용. 실제 교재 연동 시 서버에서 대체.
const DEFAULT_CHECKLIST = [
  {
    id: 'book-info',
    title: '정보처리기사 핵심 요약',
    chapters: [
      { id: 'info-ch1', label: '1장 · 소프트웨어 설계', done: false },
      { id: 'info-ch2', label: '2장 · 소프트웨어 개발', done: false },
      { id: 'info-ch3', label: '3장 · 데이터베이스 구축', done: false },
      { id: 'info-ch4', label: '4장 · 프로그래밍 언어', done: false },
      { id: 'info-ch5', label: '5장 · 정보시스템 구축관리', done: false },
    ],
  },
  {
    id: 'book-network',
    title: '네트워크 기초',
    chapters: [
      { id: 'net-ch1', label: '1장 · OSI 7계층', done: false },
      { id: 'net-ch2', label: '2장 · TCP/IP', done: false },
      { id: 'net-ch3', label: '3장 · HTTP/HTTPS', done: false },
    ],
  },
];

// 오답노트 시드 — 최초 실행 시 화면이 비어보이지 않도록 2건 기본 제공.
const DEFAULT_WRONG_ANSWERS = [
  {
    id: 'seed-wa-1',
    quizId: 'seed-quiz',
    question: 'TCP 3-way handshake의 순서로 올바른 것은?',
    options: [
      'SYN → ACK → SYN-ACK',
      'SYN → SYN-ACK → ACK',
      'ACK → SYN → SYN-ACK',
      'SYN-ACK → SYN → ACK',
    ],
    correctAnswer: 1,
    userAnswer: 0,
    explanation: '클라이언트가 SYN을 보내면, 서버가 SYN-ACK로 응답하고, 클라이언트가 ACK로 마무리합니다.',
    difficulty: 'mixed',
    type: 'multiple',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'seed-wa-2',
    quizId: 'seed-quiz',
    question: '관계형 데이터베이스에서 정규화의 주된 목적은?',
    options: ['성능 향상', '중복 제거', '보안 강화', '인덱스 최적화'],
    correctAnswer: 1,
    userAnswer: 0,
    explanation: '정규화의 핵심 목적은 데이터 중복을 제거하여 이상(anomaly)을 방지하는 것입니다.',
    difficulty: 'easy',
    type: 'multiple',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const useStudyStore = create(
  persist(
    (set, get) => ({
      // 업로드된 학습 문서 목록
      studyDocs: [],
      // 현재 진행 중인 퀴즈 데이터
      currentQuiz: null,
      // 현재 풀고 있는 문제 인덱스
      currentQuestionIndex: 0,
      // 문제별 사용자 답안 (questionId -> answer)
      answers: {},
      // 현재 단계 (settings | quiz | result)
      studyStep: 'settings',
      // 탭 이동 시 자동 일시정지되는 퀴즈 세션 플래그
      quizPaused: false,
      // 오답노트 → 퀴즈 재출제 seed (액티브 리콜)
      quizSeed: null,
      // 모의고사 타이머 (초 단위, null이면 비활성)
      quizTimerSec: null,

      // 다음 턴 채팅 스타일 (general | feynman | summary)
      chatStyle: 'general',
      // 스타일 고정 여부 (고정 시 턴마다 자동 리셋되지 않음)
      chatStyleLocked: false,

      // 누적 오답노트
      wrongAnswers: DEFAULT_WRONG_ANSWERS,
      // 교재별 체크리스트
      checklist: DEFAULT_CHECKLIST,
      // 누적 통계 (풀이 시 증가)
      stats: {
        totalSolved: 0,
        correctCount: 0,
        byDifficulty: { easy: 0, mixed: 0, hard: 0 },
        byType: { multiple: 0, ox: 0, short: 0 },
      },

      setStudyStep: (step) => set({ studyStep: step }),

      /** 새 문서를 추가하고 처리 상태로 초기화 */
      addDoc: (doc) => {
        const newDoc = { id: generateId(), status: 'processing', progress: 0, ...doc };
        set((state) => ({ studyDocs: [...state.studyDocs, newDoc] }));
        return newDoc;
      },

      /** 문서의 처리 상태와 진행률 업데이트 */
      updateDocStatus: (id, status, progress) =>
        set((state) => ({
          studyDocs: state.studyDocs.map((d) =>
            d.id === id ? { ...d, status, progress } : d
          ),
        })),

      /** 문서 삭제 */
      removeDoc: (id) =>
        set((state) => ({
          studyDocs: state.studyDocs.filter((d) => d.id !== id),
        })),

      // 퀴즈를 설정하고 진행 상태 초기화 (타이머 옵션 포함)
      setQuiz: (quiz, options = {}) =>
        set({
          currentQuiz: quiz,
          currentQuestionIndex: 0,
          answers: {},
          quizPaused: false,
          quizTimerSec: options.timerSec ?? null,
        }),

      setQuestionIndex: (index) => set({ currentQuestionIndex: index }),

      // 특정 문제에 대한 답안 제출
      submitAnswer: (questionId, answer) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),

      // 탭 이동 등으로 세션 일시정지/재개
      setQuizPaused: (paused) => set({ quizPaused: paused }),

      // 모의고사 타이머 1초 감소
      tickQuizTimer: () =>
        set((state) => {
          if (state.quizTimerSec === null || state.quizPaused) return {};
          const next = Math.max(0, state.quizTimerSec - 1);
          return { quizTimerSec: next };
        }),

      // 퀴즈 전체 초기화 (설정 단계로 복귀)
      resetQuiz: () =>
        set({
          currentQuiz: null,
          currentQuestionIndex: 0,
          answers: {},
          studyStep: 'settings',
          quizPaused: false,
          quizTimerSec: null,
          quizSeed: null,
        }),

      // 오답노트에서 "다시 풀기" 시 seed 저장 → 퀴즈 탭에서 읽어 새 세션 생성
      setQuizSeed: (seed) => set({ quizSeed: seed }),
      clearQuizSeed: () => set({ quizSeed: null }),

      // 채팅 스타일 관련 액션
      setChatStyle: (style) => set({ chatStyle: style }),
      setChatStyleLocked: (locked) => set({ chatStyleLocked: locked }),
      // 턴 종료 후 자동 리셋 (고정 상태가 아니면 'general'로)
      resetChatStyleIfNotLocked: () => {
        if (!get().chatStyleLocked) set({ chatStyle: 'general' });
      },

      /** 퀴즈 완료 시 오답 묶음을 오답노트에 추가 + 통계 반영 */
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

        // 통계 누적 — 풀이된 문제만 반영
        const solvedQs = questions.filter((q) => sessionAnswers[q.id]);
        const correctQs = solvedQs.filter((q) => sessionAnswers[q.id]?.correct);
        set((state) => {
          const s = state.stats;
          const nextByDiff = { ...s.byDifficulty };
          const nextByType = { ...s.byType };
          solvedQs.forEach((q) => {
            const d = q.difficulty || quiz.difficulty || 'mixed';
            const t = q.type || 'multiple';
            nextByDiff[d] = (nextByDiff[d] || 0) + 1;
            nextByType[t] = (nextByType[t] || 0) + 1;
          });
          return {
            wrongAnswers: [...wrongs, ...state.wrongAnswers],
            stats: {
              totalSolved: s.totalSolved + solvedQs.length,
              correctCount: s.correctCount + correctQs.length,
              byDifficulty: nextByDiff,
              byType: nextByType,
            },
          };
        });
      },

      /** 오답노트에서 특정 항목 제거 */
      removeWrongAnswer: (id) =>
        set((state) => ({ wrongAnswers: state.wrongAnswers.filter((w) => w.id !== id) })),

      /** 체크리스트 챕터 토글 */
      toggleChecklistChapter: (bookId, chapterId) =>
        set((state) => ({
          checklist: state.checklist.map((book) =>
            book.id !== bookId
              ? book
              : {
                  ...book,
                  chapters: book.chapters.map((ch) =>
                    ch.id !== chapterId ? ch : { ...ch, done: !ch.done },
                  ),
                },
          ),
        })),

      /** 로그아웃 시 호출 — 문서·퀴즈 진행 상태 등 개인 정보 초기화 (시드는 유지) */
      reset: () =>
        set({
          studyDocs: [],
          currentQuiz: null,
          currentQuestionIndex: 0,
          answers: {},
          studyStep: 'settings',
          quizPaused: false,
          quizTimerSec: null,
          quizSeed: null,
          chatStyle: 'general',
          chatStyleLocked: false,
          wrongAnswers: DEFAULT_WRONG_ANSWERS,
          checklist: DEFAULT_CHECKLIST,
          stats: { totalSolved: 0, correctCount: 0, byDifficulty: { easy: 0, mixed: 0, hard: 0 }, byType: { multiple: 0, ox: 0, short: 0 } },
        }),
    }),
    {
      name: 'study-store',
      version: 2,
      // v1(studyDocs만 저장) → v2(워크스페이스 상태 확장) 마이그레이션.
      // 구버전 키는 그대로 보존하고 신규 필드는 기본값을 채워 넣는다.
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
        if (version < 2) {
          return {
            studyDocs: persisted.studyDocs || [],
            wrongAnswers: DEFAULT_WRONG_ANSWERS,
            checklist: DEFAULT_CHECKLIST,
            chatStyleLocked: false,
            stats: { totalSolved: 0, correctCount: 0, byDifficulty: { easy: 0, mixed: 0, hard: 0 }, byType: { multiple: 0, ox: 0, short: 0 } },
          };
        }
        return persisted;
      },
      partialize: (state) => ({
        studyDocs: state.studyDocs,
        wrongAnswers: state.wrongAnswers,
        checklist: state.checklist,
        chatStyleLocked: state.chatStyleLocked,
        stats: state.stats,
      }),
    },
  ),
);

export default useStudyStore;
