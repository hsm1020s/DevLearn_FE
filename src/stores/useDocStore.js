/** @fileoverview 학습 문서 관리 스토어 — 업로드된 PDF를 로컬에서 관리한다.
 *  addDoc/updateDocStatus/updateDocInfo/removeDoc/reset 액션을 제공하며,
 *  문서 목록은 localStorage(persist)에 보관된다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useDocStore = create(
  persist(
    (set) => ({
      /** 업로드 문서 목록 */
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

      /** 문서 삭제 (로컬) */
      removeDoc: (id) =>
        set((state) => ({
          docs: state.docs.filter((d) => d.id !== id),
        })),

      /** 로그아웃 시 호출 — 문서 목록을 비운다 */
      reset: () => set({ docs: [] }),
    }),
    {
      name: 'doc-store',
      partialize: (state) => ({ docs: state.docs }),
    },
  ),
);

export default useDocStore;
