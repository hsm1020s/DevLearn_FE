/**
 * @fileoverview 마인드맵 상태 관리 스토어
 * 모드별로 독립된 마인드맵을 maps 객체에 저장하고,
 * activeMapId로 현재 캔버스에 표시할 맵을 선택한다.
 * 대화 삭제와 무관하게 마인드맵은 독립적으로 보존된다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useMindmapStore = create(
  persist(
    (set, get) => ({
      /**
       * 저장된 마인드맵 맵 객체
       * { [mapId]: { id, title, mode, nodes, createdAt, updatedAt } }
       */
      maps: {},

      /** 현재 캔버스에 열려있는 마인드맵 ID (null이면 빈 캔버스) */
      activeMapId: null,

      /** 모드별 마지막으로 열었던 마인드맵 ID (모드 전환 시 복원용) */
      lastActiveByMode: {},

      /** 현재 선택된 노드 ID */
      selectedNodeId: null,

      /** 마지막 저장 타임스탬프 */
      lastSavedAt: null,

      // ── 맵 관리 ──

      /** 새 마인드맵 생성 후 활성화 */
      createMap: (mode, title = '새 마인드맵') => {
        const id = generateId();
        const now = Date.now();
        const newMap = { id, title, mode, nodes: [], createdAt: now, updatedAt: now };
        set((state) => ({
          maps: { ...state.maps, [id]: newMap },
          activeMapId: id,
          selectedNodeId: null,
          lastSavedAt: now,
          lastActiveByMode: { ...state.lastActiveByMode, [mode]: id },
        }));
        return newMap;
      },

      /** 마인드맵 삭제 (사용자가 직접 선택) */
      deleteMap: (mapId) =>
        set((state) => {
          const { [mapId]: _, ...rest } = state.maps;
          const updatedLastActive = { ...state.lastActiveByMode };
          // lastActiveByMode에서도 제거
          Object.entries(updatedLastActive).forEach(([mode, id]) => {
            if (id === mapId) delete updatedLastActive[mode];
          });
          return {
            maps: rest,
            activeMapId: state.activeMapId === mapId ? null : state.activeMapId,
            selectedNodeId: state.activeMapId === mapId ? null : state.selectedNodeId,
            lastActiveByMode: updatedLastActive,
          };
        }),

      /** 마인드맵 제목 변경 */
      renameMap: (mapId, title) =>
        set((state) => ({
          maps: {
            ...state.maps,
            [mapId]: { ...state.maps[mapId], title, updatedAt: Date.now() },
          },
        })),

      /** 특정 마인드맵을 캔버스에 로드 */
      loadMap: (mapId) => {
        const map = get().maps[mapId];
        if (!map) return;
        set((state) => ({
          activeMapId: mapId,
          selectedNodeId: null,
          lastActiveByMode: { ...state.lastActiveByMode, [map.mode]: mapId },
        }));
      },

      /** 모드 전환 시 해당 모드의 마지막 맵 복원 (없으면 null) */
      restoreForMode: (mode) => {
        const lastId = get().lastActiveByMode[mode];
        if (lastId && get().maps[lastId]) {
          set({ activeMapId: lastId, selectedNodeId: null });
        } else {
          set({ activeMapId: null, selectedNodeId: null });
        }
      },

      /** 현재 모드에 해당하는 마인드맵 목록 반환 */
      getMapsByMode: (mode) =>
        Object.values(get().maps)
          .filter((m) => m.mode === mode)
          .sort((a, b) => b.updatedAt - a.updatedAt),

      /** 현재 활성 맵의 nodes 반환 (없으면 빈 배열) */
      getActiveNodes: () => {
        const { activeMapId, maps } = get();
        return activeMapId && maps[activeMapId] ? maps[activeMapId].nodes : [];
      },

      // ── 노드 CRUD (활성 맵 내에서 동작) ──

      /** 부모 노드 아래에 새 자식 노드 추가 */
      addNode: (parentId, label) => {
        const { activeMapId, maps } = get();
        if (!activeMapId || !maps[activeMapId]) return null;

        const id = generateId();
        const node = { id, label, parentId, position: { x: 0, y: 0 }, color: null };
        const now = Date.now();
        set((state) => ({
          maps: {
            ...state.maps,
            [activeMapId]: {
              ...state.maps[activeMapId],
              nodes: [...state.maps[activeMapId].nodes, node],
              updatedAt: now,
            },
          },
          lastSavedAt: now,
        }));
        return node;
      },

      /** 노드와 하위 자식 노드를 재귀적으로 삭제 */
      deleteNode: (nodeId) => {
        const { activeMapId } = get();
        if (!activeMapId) return;

        set((state) => {
          const map = state.maps[activeMapId];
          if (!map) return state;

          const toDelete = new Set([nodeId]);
          const findChildren = (id) => {
            map.nodes.forEach((n) => {
              if (n.parentId === id) {
                toDelete.add(n.id);
                findChildren(n.id);
              }
            });
          };
          findChildren(nodeId);

          const now = Date.now();
          return {
            maps: {
              ...state.maps,
              [activeMapId]: {
                ...map,
                nodes: map.nodes.filter((n) => !toDelete.has(n.id)),
                updatedAt: now,
              },
            },
            selectedNodeId:
              state.selectedNodeId && toDelete.has(state.selectedNodeId)
                ? null
                : state.selectedNodeId,
            lastSavedAt: now,
          };
        });
      },

      /** 노드 속성 부분 업데이트 (라벨, 위치, 색상 등) */
      updateNode: (nodeId, data) => {
        const { activeMapId } = get();
        if (!activeMapId) return;

        set((state) => {
          const map = state.maps[activeMapId];
          if (!map) return state;
          const now = Date.now();
          return {
            maps: {
              ...state.maps,
              [activeMapId]: {
                ...map,
                nodes: map.nodes.map((n) => (n.id === nodeId ? { ...n, ...data } : n)),
                updatedAt: now,
              },
            },
            lastSavedAt: now,
          };
        });
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      markSaved: () => set({ lastSavedAt: Date.now() }),

      /** 현재 활성 맵의 모든 노드 삭제 (맵 자체는 유지) */
      clearAll: () => {
        const { activeMapId } = get();
        if (!activeMapId) return;
        set((state) => {
          const map = state.maps[activeMapId];
          if (!map) return state;
          return {
            maps: {
              ...state.maps,
              [activeMapId]: { ...map, nodes: [], updatedAt: Date.now() },
            },
            selectedNodeId: null,
            lastSavedAt: null,
          };
        });
      },
    }),
    {
      name: 'mindmap-store',
      version: 1,
      partialize: (state) => ({
        maps: state.maps,
        lastActiveByMode: state.lastActiveByMode,
      }),
      // 이전 버전(nodes 배열)에서 새 구조(maps 객체)로 마이그레이션
      migrate: (persisted, version) => {
        if (version === 0 && persisted.nodes) {
          const migrated = { maps: {}, lastActiveByMode: {} };
          // 기존 노드가 있으면 general 모드 마인드맵으로 변환
          if (persisted.nodes.length > 0) {
            const id = 'migrated-' + Date.now();
            migrated.maps[id] = {
              id,
              title: '마이그레이션 마인드맵',
              mode: 'general',
              nodes: persisted.nodes,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            migrated.lastActiveByMode.general = id;
          }
          return migrated;
        }
        return persisted;
      },
    },
  ),
);

export default useMindmapStore;
