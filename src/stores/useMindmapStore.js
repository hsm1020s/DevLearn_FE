import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId, calculateNodePosition } from '../utils/helpers';

const useMindmapStore = create(
  persist(
    (set, get) => ({
      nodes: [],
      selectedNodeId: null,

      addNode: (parentId, label) => {
        const { nodes } = get();
        const id = generateId();
        const position = calculateNodePosition(parentId, nodes);
        const node = { id, label, parentId, position, color: null };
        set((state) => ({ nodes: [...state.nodes, node] }));
        return node;
      },

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
          };
        }),

      updateNode: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, ...data } : n)),
        })),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      clearAll: () => set({ nodes: [], selectedNodeId: null }),
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
