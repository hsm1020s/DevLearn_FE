/** @fileoverview RAG 문서 관리 스토어 (문서 업로드, 인덱싱 상태 추적, 삭제) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useRagStore = create(
  persist(
    (set) => ({
      // RAG용 업로드 문서 목록
      ragDocs: [],

      /** 새 문서를 추가하고 인덱싱 상태로 초기화 */
      addDoc: (doc) => {
        const newDoc = { id: generateId(), status: 'indexing', progress: 0, ...doc };
        set((state) => ({ ragDocs: [...state.ragDocs, newDoc] }));
        return newDoc;
      },

      /** 문서의 인덱싱 상태와 진행률 업데이트 */
      updateDocStatus: (id, status, progress) =>
        set((state) => ({
          ragDocs: state.ragDocs.map((d) =>
            d.id === id ? { ...d, status, progress } : d
          ),
        })),

      /** 문서의 부가 정보(페이지 수, 청크 수 등)를 업데이트 */
      updateDocInfo: (id, info) =>
        set((state) => ({
          ragDocs: state.ragDocs.map((d) =>
            d.id === id ? { ...d, ...info } : d
          ),
        })),

      // 문서 삭제
      removeDoc: (id) =>
        set((state) => ({
          ragDocs: state.ragDocs.filter((d) => d.id !== id),
        })),
    }),
    {
      name: 'rag-store',
      partialize: (state) => ({
        ragDocs: state.ragDocs,
      }),
    },
  ),
);

export default useRagStore;
