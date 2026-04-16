/** @fileoverview 자격증 모드 상태 관리 스토어 (문서 업로드, 퀴즈 진행, 답안 관리) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useCertStore = create(
  persist(
    (set) => ({
      // 업로드된 자격증 학습 문서 목록
      certDocs: [],
      // 현재 진행 중인 퀴즈 데이터
      currentQuiz: null,
      // 현재 풀고 있는 문제 인덱스
      currentQuestionIndex: 0,
      // 문제별 사용자 답안 (questionId -> answer)
      answers: {},
      // 현재 단계 (upload -> quiz -> result)
      certStep: 'upload',

      setCertStep: (step) => set({ certStep: step }),

      /** 새 문서를 추가하고 처리 상태로 초기화 */
      addDoc: (doc) => {
        const newDoc = { id: generateId(), status: 'processing', progress: 0, ...doc };
        set((state) => ({ certDocs: [...state.certDocs, newDoc] }));
        return newDoc;
      },

      /** 문서의 처리 상태와 진행률 업데이트 */
      updateDocStatus: (id, status, progress) =>
        set((state) => ({
          certDocs: state.certDocs.map((d) =>
            d.id === id ? { ...d, status, progress } : d
          ),
        })),

      // 퀴즈를 설정하고 진행 상태 초기화
      setQuiz: (quiz) => set({ currentQuiz: quiz, currentQuestionIndex: 0, answers: {} }),

      setQuestionIndex: (index) => set({ currentQuestionIndex: index }),

      // 특정 문제에 대한 답안 제출
      submitAnswer: (questionId, answer) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),

      // 퀴즈 전체 초기화 (업로드 단계로 복귀)
      resetQuiz: () => set({ currentQuiz: null, currentQuestionIndex: 0, answers: {}, certStep: 'upload' }),
    }),
    {
      name: 'cert-store',
      partialize: (state) => ({
        certDocs: state.certDocs,
      }),
    },
  ),
);

export default useCertStore;
