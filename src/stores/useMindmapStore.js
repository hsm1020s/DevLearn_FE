/** @fileoverview 마인드맵 노드 상태 관리 스토어 (노드 CRUD, 선택, 저장 시점 추적) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useMindmapStore = create(
  persist(
    (set, get) => ({
      // 마인드맵 노드 배열
      nodes: [],
      // 현재 선택된 노드 ID
      selectedNodeId: null,
      // 마지막 저장 타임스탬프
      lastSavedAt: null,

      markSaved: () => set({ lastSavedAt: Date.now() }),

      /** 부모 노드 아래에 새 자식 노드 추가 */
      addNode: (parentId, label) => {
        const id = generateId();
        const node = { id, label, parentId, position: { x: 0, y: 0 }, color: null };
        set((state) => ({ nodes: [...state.nodes, node], lastSavedAt: Date.now() }));
        return node;
      },

      /** 노드와 하위 자식 노드를 재귀적으로 삭제 */
      deleteNode: (nodeId) =>
        set((state) => {
          const toDelete = new Set([nodeId]);
          const findChildren = (id) => {
            state.nodes.forEach((n) => {
              if (n.parentId === id) {
                toDelete.add(n.id);
                findChildren(n.id);
              }
            });
          };
          findChildren(nodeId);
          return {
            nodes: state.nodes.filter((n) => !toDelete.has(n.id)),
            selectedNodeId:
              state.selectedNodeId && toDelete.has(state.selectedNodeId)
                ? null
                : state.selectedNodeId,
            lastSavedAt: Date.now(),
          };
        }),

      // 노드 속성 부분 업데이트 (라벨, 위치, 색상 등)
      updateNode: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, ...data } : n)),
          lastSavedAt: Date.now(),
        })),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      // 모든 노드 및 선택 상태 초기화
      clearAll: () => set({ nodes: [], selectedNodeId: null, lastSavedAt: null }),
    }),
    {
      name: 'mindmap-store',
      partialize: (state) => ({
        nodes: state.nodes,
      }),
    },
  ),
);

export default useMindmapStore;
