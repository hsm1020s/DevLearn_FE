/**
 * @fileoverview 업무학습 모드 스토어 — 업무노트(자유 기록)와 사용자 정의 체크리스트.
 *
 * 자격증 모드의 "PDF→퀴즈→오답→통계" 루프와 달리, 업무학습은 정답이 없는
 * 지식 기록·반복 확인이 핵심이므로 노트 CRUD + 체크리스트 CRUD만 담는다.
 * 백엔드 API는 아직 없고 FE localStorage persist만 사용한다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

/** 업무노트 1건 — 자유 형식 지식 기록. */
const makeNote = ({ title, body, tags }) => {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title?.trim() || '제목 없음',
    body: body || '',
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    createdAt: now,
    updatedAt: now,
  };
};

/** 체크리스트 프로젝트 1건 — 챕터 리스트를 묶는 상위 카테고리. */
const makeProject = ({ title }) => ({
  id: generateId(),
  title: title?.trim() || '새 프로젝트',
  chapters: [],
});

const useWorkLearnStore = create(
  persist(
    (set) => ({
      /** 업무노트 배열 — 최신순으로 UI에 렌더 */
      notes: [],
      /** 사용자 정의 체크리스트 — 각 프로젝트는 {id, title, chapters:[{id,label,done}]} */
      checklist: [],

      // ────────── 업무노트 ──────────
      /** 새 노트 생성 후 상단에 추가. 반환값은 생성된 노트(편집 즉시 열기 등에 활용). */
      addNote: (input) => {
        const note = makeNote(input);
        set((state) => ({ notes: [note, ...state.notes] }));
        return note;
      },

      /** 부분 수정 — title/body/tags 중 주어진 값만 덮어쓰고 updatedAt 갱신. */
      updateNote: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id !== id
              ? n
              : {
                  ...n,
                  ...patch,
                  // tags 패치가 있으면 배열만, 없으면 기존 유지
                  tags: patch.tags ? patch.tags.filter(Boolean) : n.tags,
                  updatedAt: new Date().toISOString(),
                },
          ),
        })),

      /** 노트 삭제 — 팝오버 확인 이후에만 호출됨. */
      removeNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

      // ────────── 체크리스트 ──────────
      /** 빈 프로젝트 생성. 챕터는 이후 addChecklistItem으로 채운다. */
      addChecklistProject: (input) => {
        const project = makeProject(input);
        set((state) => ({ checklist: [...state.checklist, project] }));
        return project;
      },

      /** 프로젝트 이름 변경 */
      renameChecklistProject: (projectId, title) =>
        set((state) => ({
          checklist: state.checklist.map((p) =>
            p.id !== projectId ? p : { ...p, title: title?.trim() || p.title },
          ),
        })),

      /** 프로젝트 삭제 */
      removeChecklistProject: (projectId) =>
        set((state) => ({ checklist: state.checklist.filter((p) => p.id !== projectId) })),

      /** 챕터(항목) 추가 — 라벨만 받고 done은 false로 시작. */
      addChecklistItem: (projectId, label) =>
        set((state) => ({
          checklist: state.checklist.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  chapters: [
                    ...p.chapters,
                    { id: generateId(), label: label?.trim() || '새 항목', done: false },
                  ],
                },
          ),
        })),

      /** 챕터 완료 토글 — ChecklistPanel의 체크박스에서 호출. */
      toggleChecklistChapter: (projectId, chapterId) =>
        set((state) => ({
          checklist: state.checklist.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  chapters: p.chapters.map((ch) =>
                    ch.id !== chapterId ? ch : { ...ch, done: !ch.done },
                  ),
                },
          ),
        })),

      /** 챕터 삭제 */
      removeChecklistItem: (projectId, chapterId) =>
        set((state) => ({
          checklist: state.checklist.map((p) =>
            p.id !== projectId
              ? p
              : { ...p, chapters: p.chapters.filter((ch) => ch.id !== chapterId) },
          ),
        })),

      /** 로그아웃 시 호출 — 노트·체크리스트 전부 비움. */
      reset: () => set({ notes: [], checklist: [] }),
    }),
    {
      name: 'worklearn-store',
      version: 1,
      partialize: (state) => ({
        notes: state.notes,
        checklist: state.checklist,
      }),
    },
  ),
);

export default useWorkLearnStore;
