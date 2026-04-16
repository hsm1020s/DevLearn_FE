/** @fileoverview 통합 문서 관리 스토어 — 모든 PDF를 하나의 목록에서 관리한다. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useDocStore = create(
  persist(
    (set) => ({
      // 전체 업로드 문서 목록
      docs: [],

      /** 새 문서 추가 (업로드 시) */
      addDoc: (doc) => {
        const newDoc = {
          id: generateId(),
          status: 'processing',
          progress: 0,
          pages: 0,
          chunks: 0,
          ...doc,
        };
        set((state) => ({ docs: [...state.docs, newDoc] }));
        return newDoc;
      },

      /** 문서 처리 상태·진행률 업데이트 */
      updateDocStatus: (id, status, progress) =>
        set((state) => ({
          docs: state.docs.map((d) =>
            d.id === id ? { ...d, status, progress } : d
          ),
        })),

      /** 문서 부가 정보(페이지 수, 청크 수 등) 업데이트 */
      updateDocInfo: (id, info) =>
        set((state) => ({
          docs: state.docs.map((d) =>
            d.id === id ? { ...d, ...info } : d
          ),
        })),

      /** 문서 삭제 */
      removeDoc: (id) =>
        set((state) => ({
          docs: state.docs.filter((d) => d.id !== id),
        })),
    }),
    {
      name: 'doc-store',
      partialize: (state) => ({
        docs: state.docs,
      }),
    },
  ),
);

export default useDocStore;
