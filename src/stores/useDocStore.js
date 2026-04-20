/** @fileoverview 통합 문서 관리 스토어 — 모든 PDF를 하나의 목록에서 관리한다.
 *  서버 연동(fetchDocs / pollDocStatus / stopPolling)을 포함하며,
 *  기존 액션(addDoc/updateDocStatus/updateDocInfo/removeDoc)은 그대로 유지한다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import { listRagDocs } from '../services/ragApi';
import { showError } from '../utils/errorHandler';

/**
 * 폴링 중복 방지용 모듈 스코프 Set (persist 밖)
 * @type {Set<string>}
 */
const activePollers = new Set();

/** 폴링 간격(ms) */
const POLL_INTERVAL = 2000;

const useDocStore = create(
  persist(
    (set, get) => ({
      // 전체 업로드 문서 목록
      docs: [],

      // 서버 동기화 상태 (persist 제외)
      isLoadingDocs: false,
      fetchError: null,

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

      /** 문서 삭제 (로컬) — 서버 호출은 호출부에서 deleteDocument 선행 */
      removeDoc: (id) => {
        // 삭제된 문서의 폴링도 즉시 중단
        activePollers.delete(id);
        set((state) => ({
          docs: state.docs.filter((d) => d.id !== id),
        }));
      },

      /**
       * 서버에서 문서 목록을 조회하고 로컬 상태를 갱신한다.
       * 업로드 중인 pending(서버에 아직 없는 id)은 보존하고,
       * 서버 응답과 병합한다. 실패 시 토스트만 띄우고 기존 배열 유지.
       */
      fetchDocs: async () => {
        set({ isLoadingDocs: true, fetchError: null });
        try {
          const serverDocs = await listRagDocs();
          const prev = get().docs;
          const serverIds = new Set(serverDocs.map((d) => d.id));
          // 서버에 없는 pending/로컬 업로드 중 항목은 유지
          const pending = prev.filter(
            (d) => !serverIds.has(d.id) && d.status !== 'completed' && d.status !== 'error'
          );
          set({ docs: [...serverDocs, ...pending], isLoadingDocs: false });
          // processing 상태는 자동 폴링 시작
          serverDocs.forEach((d) => {
            if (d.status === 'processing' || d.status === 'indexing') {
              get().pollDocStatus(d.id);
            }
          });
        } catch (err) {
          set({ isLoadingDocs: false, fetchError: err?.message || '문서 목록을 불러오지 못했습니다' });
          showError(err, '문서 목록을 불러오지 못했습니다');
        }
      },

      /**
       * 특정 문서가 completed|error가 될 때까지 2초 간격으로 재귀 폴링한다.
       * 모듈 스코프 Set으로 중복 폴러를 방지한다.
       * @param {string} docId
       */
      pollDocStatus: (docId) => {
        if (activePollers.has(docId)) return;
        activePollers.add(docId);

        const tick = async () => {
          // 외부에서 중단되었거나 문서가 사라졌으면 종료
          if (!activePollers.has(docId)) return;
          try {
            const serverDocs = await listRagDocs();
            const target = serverDocs.find((d) => d.id === docId);
            if (!target) {
              activePollers.delete(docId);
              return;
            }
            // 로컬 반영
            set((state) => ({
              docs: state.docs.map((d) =>
                d.id === docId
                  ? { ...d, status: target.status, progress: target.progress ?? d.progress, pages: target.pages ?? d.pages, chunks: target.chunks ?? d.chunks }
                  : d
              ),
            }));
            if (target.status === 'completed' || target.status === 'error') {
              activePollers.delete(docId);
              return;
            }
            setTimeout(tick, POLL_INTERVAL);
          } catch {
            // 1회 실패 시 중단
            activePollers.delete(docId);
          }
        };

        setTimeout(tick, POLL_INTERVAL);
      },

      /** 특정 문서의 폴링을 중단한다 */
      stopPolling: (docId) => {
        activePollers.delete(docId);
      },

      /** 로그아웃 시 호출 — 문서 목록과 진행 중 폴링을 모두 정리한다. */
      reset: () => {
        activePollers.clear();
        set({ docs: [], isLoadingDocs: false, fetchError: null });
      },
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
