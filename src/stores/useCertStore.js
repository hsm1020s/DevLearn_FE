import { create } from 'zustand';
import { generateId } from '../utils/helpers';

const useCertStore = create((set) => ({
  certDocs: [],
  currentQuiz: null,
  currentQuestionIndex: 0,
  answers: {},
  certStep: 'upload',

  setCertStep: (step) => set({ certStep: step }),

  addDoc: (doc) => {
    const newDoc = { id: generateId(), status: 'processing', progress: 0, ...doc };
    set((state) => ({ certDocs: [...state.certDocs, newDoc] }));
    return newDoc;
  },

  updateDocStatus: (id, status, progress) =>
    set((state) => ({
      certDocs: state.certDocs.map((d) =>
        d.id === id ? { ...d, status, progress } : d
      ),
    })),

  setQuiz: (quiz) => set({ currentQuiz: quiz, currentQuestionIndex: 0, answers: {} }),

  setQuestionIndex: (index) => set({ currentQuestionIndex: index }),

  submitAnswer: (questionId, answer) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),

  resetQuiz: () => set({ currentQuiz: null, currentQuestionIndex: 0, answers: {}, certStep: 'upload' }),
}));

export default useCertStore;
