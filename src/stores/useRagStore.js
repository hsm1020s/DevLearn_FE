import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useRagStore = create(
  persist(
    (set) => ({
      ragDocs: [],

      addDoc: (doc) => {
        const newDoc = { id: generateId(), status: 'indexing', progress: 0, ...doc };
        set((state) => ({ ragDocs: [...state.ragDocs, newDoc] }));
        return newDoc;
      },

      updateDocStatus: (id, status, progress) =>
        set((state) => ({
          ragDocs: state.ragDocs.map((d) =>
            d.id === id ? { ...d, status, progress } : d
          ),
        })),

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
