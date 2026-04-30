/**
 * @fileoverview 마인드맵 상태 관리 스토어 (서버 동기화 포함)
 * - 모드별로 독립된 마인드맵을 maps 객체에 저장하고, activeMapId로 현재 맵을 선택한다.
 * - 편집은 로컬에 즉시 반영하고, 1.5초 debounce로 서버 자동 저장을 트리거한다.
 * - 신규 생성 맵은 isLocal=true로 표시되고, 첫 저장 성공 시 서버가 발급한 id로 키를 교체한다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import {
  saveMindmap,
  getMindmap,
  getMindmapList,
  deleteMindmap,
} from '../services/mindmapApi';
import { showError } from '../utils/errorHandler';

// ── 모듈 스코프 (persist 대상 아님) ──
/** mapId → setTimeout 핸들. 디바운스 저장 예약 상태 */
const saveTimers = new Map();
/** 저장 중 편집 발생 시 완료 후 재예약하기 위한 dirty 셋 */
const dirtySet = new Set();

/** 디바운스 지연(ms) */
const SAVE_DEBOUNCE_MS = 1500;
/** 저장 실패 시 단일 재시도 지연(ms) */
const SAVE_RETRY_MS = 3000;

const useMindmapStore = create(
  persist(
    (set, get) => ({
      /**
       * 저장된 마인드맵 맵 객체
       * { [mapId]: { id, title, mode, nodes, createdAt, updatedAt, isLocal? } }
       */
      maps: {},

      /** 현재 캔버스에 열려있는 마인드맵 ID (null이면 빈 캔버스) */
      activeMapId: null,

      /** 모드별 마지막으로 열었던 마인드맵 ID (모드 전환 시 복원용) */
      lastActiveByMode: {},

      /** 현재 선택된 노드 ID */
      selectedNodeId: null,

      /**
       * TTS 재생 중인 노드 ID (null이면 없음).
       * persist 제외 대상 — 새로고침 시 항상 null로 시작.
       * 값이 바뀌면 MindmapNode의 data.isPlaying을 통해 앰버 톤 하이라이트가 이동한다.
       */
      playingNodeId: null,

      /**
       * TTS 전역 상태: 'idle' | 'playing' | 'paused'.
       * 컨트롤 버튼(재생/일시정지/정지)의 UI 상태 결정 및 훅 내부 로직 분기에 사용.
       * persist 제외 대상.
       */
      ttsStatus: 'idle',

      /** 마지막 저장 타임스탬프 (로컬 편집 기준) */
      lastSavedAt: null,

      /** 맵별 동기화 상태: 'idle' | 'saving' | 'saved' | 'error' */
      syncStatus: {},

      /** 맵별 마지막 서버 저장 타임스탬프 */
      lastServerSyncAt: {},

      /** 목록 로딩 중 여부 */
      isListLoading: false,

      // ── 맵 관리 ──

      /** 새 마인드맵 생성 후 활성화 (isLocal=true로 표시, 첫 편집/저장 시 서버로 업로드) */
      createMap: (mode, title = '새 마인드맵') => {
        const id = generateId();
        const now = Date.now();
        const newMap = {
          id,
          title,
          mode,
          nodes: [],
          createdAt: now,
          updatedAt: now,
          isLocal: true,
        };
        set((state) => ({
          maps: { ...state.maps, [id]: newMap },
          activeMapId: id,
          selectedNodeId: null,
          lastSavedAt: now,
          lastActiveByMode: { ...state.lastActiveByMode, [mode]: id },
        }));
        // 신규 생성 직후 debounce 저장 예약 → 서버 id 발급
        get().scheduleSave(id);
        return newMap;
      },

      /**
       * 마인드맵 삭제.
       * - isLocal=true 이면 서버 호출 없이 로컬만 제거
       * - 그 외엔 서버 삭제 호출 후 로컬 제거 (실패 시 토스트만 띄우고 로컬 상태는 유지하지 않음 → 설계 단순화를 위해 로컬 제거 진행)
       */
      deleteMap: (mapId) => {
        const map = get().maps[mapId];
        // 예약된 저장 타이머 취소
        if (saveTimers.has(mapId)) {
          clearTimeout(saveTimers.get(mapId));
          saveTimers.delete(mapId);
        }
        dirtySet.delete(mapId);

        if (map && !map.isLocal) {
          // 서버 삭제는 fire-and-forget (실패 시 토스트)
          deleteMindmap(mapId).catch((err) => showError(err, '마인드맵 삭제에 실패했습니다'));
        }

        set((state) => {
          const { [mapId]: _, ...rest } = state.maps;
          const updatedLastActive = { ...state.lastActiveByMode };
          Object.entries(updatedLastActive).forEach(([mode, id]) => {
            if (id === mapId) delete updatedLastActive[mode];
          });
          const { [mapId]: __, ...restSyncStatus } = state.syncStatus;
          const { [mapId]: ___, ...restLastSync } = state.lastServerSyncAt;
          return {
            maps: rest,
            activeMapId: state.activeMapId === mapId ? null : state.activeMapId,
            selectedNodeId: state.activeMapId === mapId ? null : state.selectedNodeId,
            lastActiveByMode: updatedLastActive,
            syncStatus: restSyncStatus,
            lastServerSyncAt: restLastSync,
          };
        });
      },

      /** 마인드맵 제목 변경 */
      renameMap: (mapId, title) => {
        set((state) => ({
          maps: {
            ...state.maps,
            [mapId]: { ...state.maps[mapId], title, updatedAt: Date.now() },
          },
        }));
        get().scheduleSave(mapId);
      },

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

        // 루트는 맵당 단 하나. 부모 없이(parentId=null) 추가 시 이미 루트가 있으면 거부.
        if (parentId == null && maps[activeMapId].nodes.some((n) => n.parentId == null)) {
          return null;
        }

        const id = generateId();
        const node = { id, label, parentId, position: { x: 0, y: 0 }, color: null, description: '' };
        const now = Date.now();
        set((state) => {
          const map = state.maps[activeMapId];
          // 접힌 부모에 자식 추가 시 자동 펼침 — 새 자식이 숨겨지는 혼란 방지
          const parentUnfolded = map.nodes.map((n) =>
            n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n,
          );
          return {
            maps: {
              ...state.maps,
              [activeMapId]: {
                ...map,
                nodes: [...parentUnfolded, node],
                updatedAt: now,
              },
            },
            lastSavedAt: now,
          };
        });
        get().scheduleSave(activeMapId);
        return node;
      },

      /**
       * 노드 접힘/펼침 토글 (UI 상태, 서버 저장 스케줄 없음).
       * 현재는 `_performSave`에서 collapsed 필드를 strip하므로 FE-전용으로 동작하며,
       * BE가 노드 단위 계층 저장을 지원하게 되면 strip 로직만 제거하면 된다.
       */
      toggleCollapsed: (nodeId) => {
        const { activeMapId } = get();
        if (!activeMapId) return;
        set((state) => {
          const map = state.maps[activeMapId];
          if (!map) return state;
          return {
            maps: {
              ...state.maps,
              [activeMapId]: {
                ...map,
                nodes: map.nodes.map((n) =>
                  n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n,
                ),
              },
            },
          };
        });
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
        get().scheduleSave(activeMapId);
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
        get().scheduleSave(activeMapId);
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      // ── TTS 상태 setter ──
      setPlayingNode: (nodeId) => set({ playingNodeId: nodeId }),
      setTtsStatus: (status) => set({ ttsStatus: status }),
      resetTts: () => set({ playingNodeId: null, ttsStatus: 'idle' }),

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
        get().scheduleSave(activeMapId);
      },

      // ── 서버 동기화 액션 ──

      /**
       * 서버 목록을 pull 하여 maps에 병합한다.
       * - 이미 로컬에 nodes가 있으면 덮어쓰지 않는다 (편집 충돌 방지)
       * - 로컬에 없는 맵은 placeholder(nodes: [])로 추가한다
       */
      fetchMapList: async () => {
        set({ isListLoading: true });
        try {
          const list = await getMindmapList();
          set((state) => {
            const mergedMaps = { ...state.maps };
            const mergedSyncStatus = { ...state.syncStatus };
            list.forEach((summary) => {
              const updatedAtMs =
                typeof summary.updatedAt === 'string'
                  ? new Date(summary.updatedAt).getTime()
                  : summary.updatedAt || Date.now();
              const existing = mergedMaps[summary.id];
              if (existing && existing.nodes && existing.nodes.length > 0) {
                // 로컬에 노드가 있으면 메타만 갱신 (nodes overwrite 금지)
                mergedMaps[summary.id] = {
                  ...existing,
                  title: summary.title ?? existing.title,
                  mode: summary.mode ?? existing.mode,
                  updatedAt: updatedAtMs,
                  isLocal: false,
                };
              } else {
                // 로컬에 없거나 nodes가 비어있으면 placeholder로 병합
                mergedMaps[summary.id] = {
                  id: summary.id,
                  title: summary.title ?? '마인드맵',
                  mode: summary.mode ?? 'general',
                  nodes: [],
                  createdAt: existing?.createdAt ?? updatedAtMs,
                  updatedAt: updatedAtMs,
                  isLocal: false,
                };
                mergedSyncStatus[summary.id] = 'idle';
              }
            });
            return { maps: mergedMaps, syncStatus: mergedSyncStatus, isListLoading: false };
          });
        } catch (err) {
          showError(err, '마인드맵 목록 조회 실패');
          set({ isListLoading: false });
        }
      },

      /** 서버에서 특정 맵의 상세(nodes)를 받아 로컬을 덮어쓴다 */
      loadMapFromServer: async (id) => {
        try {
          const detail = await getMindmap(id);
          set((state) => {
            const existing = state.maps[id];
            return {
              maps: {
                ...state.maps,
                [id]: {
                  ...(existing || {}),
                  id,
                  title: detail.title ?? existing?.title ?? '마인드맵',
                  mode: detail.mode ?? existing?.mode ?? 'general',
                  nodes: detail.nodes || [],
                  createdAt: existing?.createdAt ?? Date.now(),
                  updatedAt: Date.now(),
                  isLocal: false,
                },
              },
              syncStatus: { ...state.syncStatus, [id]: 'saved' },
              lastServerSyncAt: { ...state.lastServerSyncAt, [id]: Date.now() },
            };
          });
        } catch (err) {
          showError(err, '마인드맵 조회 실패');
        }
      },

      /**
       * 디바운스 저장 예약.
       * - 같은 맵의 기존 타이머는 취소하고 1.5초 후 _performSave 실행
       */
      scheduleSave: (mapId) => {
        if (!mapId) return;
        // 저장 중에 호출되면 dirty로 표시 → 완료 후 재예약
        const status = get().syncStatus[mapId];
        if (status === 'saving') {
          dirtySet.add(mapId);
          return;
        }
        if (saveTimers.has(mapId)) clearTimeout(saveTimers.get(mapId));
        const handle = setTimeout(() => {
          saveTimers.delete(mapId);
          get()._performSave(mapId);
        }, SAVE_DEBOUNCE_MS);
        saveTimers.set(mapId, handle);
      },

      /** 즉시 저장 (디바운스 건너뜀) — 활성 맵 대상 */
      saveActiveNow: () => {
        const { activeMapId } = get();
        if (!activeMapId) return;
        if (saveTimers.has(activeMapId)) {
          clearTimeout(saveTimers.get(activeMapId));
          saveTimers.delete(activeMapId);
        }
        get()._performSave(activeMapId);
      },

      /**
       * 내부: 실제 서버 저장 수행.
       * - 신규(isLocal=true) 맵은 서버가 발급한 id로 키 교체 + activeMapId/lastActiveByMode 치환
       * - 실패 시 1회만 재시도, 계속 실패하면 error 상태
       */
      _performSave: async (mapId, isRetry = false) => {
        // 비로그인 상태에서는 서버 저장을 스킵한다. 401 → refresh 실패 → 토스트 스팸을
        // 방지하고, 로컬 편집(isLocal=true)은 그대로 유지되어 로그인 후 다음 편집 시
        // 자연스럽게 서버에 업로드된다.
        if (!localStorage.getItem('accessToken')) return;
        const map = get().maps[mapId];
        if (!map) return;

        set((state) => ({
          syncStatus: { ...state.syncStatus, [mapId]: 'saving' },
        }));

        try {
          // isLocal=true 이면 id를 서버에 보내지 않아 새 id를 발급받는다.
          // collapsed는 FE 전용 상태 — payload에서 제거. description은 BE에 저장.
          const payload = {
            id: map.isLocal ? undefined : mapId,
            title: map.title,
            mode: map.mode,
            nodes: map.nodes.map(({ collapsed: _c, ...rest }) => rest),
          };
          const res = await saveMindmap(payload);
          const serverId = res?.id;

          set((state) => {
            let nextActiveMapId = state.activeMapId;
            let nextLastActiveByMode = state.lastActiveByMode;
            const nextSyncStatus = { ...state.syncStatus };
            const nextLastSync = { ...state.lastServerSyncAt };

            if (serverId && serverId !== mapId) {
              // 서버가 신규 id를 발급 → 키 교체
              const { [mapId]: oldEntry, ...restMaps } = state.maps;
              const nextMaps = {
                ...restMaps,
                [serverId]: {
                  ...oldEntry,
                  id: serverId,
                  isLocal: false,
                  updatedAt: Date.now(),
                },
              };

              if (nextActiveMapId === mapId) nextActiveMapId = serverId;

              nextLastActiveByMode = { ...state.lastActiveByMode };
              Object.entries(nextLastActiveByMode).forEach(([m, id]) => {
                if (id === mapId) nextLastActiveByMode[m] = serverId;
              });

              delete nextSyncStatus[mapId];
              delete nextLastSync[mapId];
              nextSyncStatus[serverId] = 'saved';
              nextLastSync[serverId] = Date.now();

              return {
                maps: nextMaps,
                activeMapId: nextActiveMapId,
                lastActiveByMode: nextLastActiveByMode,
                syncStatus: nextSyncStatus,
                lastServerSyncAt: nextLastSync,
              };
            }

            // id 동일한 경우 — 기존 엔트리 갱신만
            const finalId = serverId || mapId;
            const nextMaps = {
              ...state.maps,
              [finalId]: {
                ...state.maps[finalId],
                isLocal: false,
                updatedAt: Date.now(),
              },
            };
            nextSyncStatus[finalId] = 'saved';
            nextLastSync[finalId] = Date.now();

            return {
              maps: nextMaps,
              syncStatus: nextSyncStatus,
              lastServerSyncAt: nextLastSync,
            };
          });

          // 저장 중 누적된 dirty 가 있으면 재예약 (키 교체 고려)
          const finalId = serverId && serverId !== mapId ? serverId : mapId;
          const hadOldDirty = dirtySet.delete(mapId);
          const hadNewDirty = dirtySet.delete(finalId);
          if (hadOldDirty || hadNewDirty) {
            get().scheduleSave(finalId);
          }
        } catch (err) {
          if (!isRetry) {
            // 단일 재시도
            setTimeout(() => {
              get()._performSave(mapId, true);
            }, SAVE_RETRY_MS);
            return;
          }
          set((state) => ({
            syncStatus: { ...state.syncStatus, [mapId]: 'error' },
          }));
          showError(err, '마인드맵 저장 실패');
        }
      },

      /**
       * 로그아웃 시 호출 — 모든 맵과 저장 타이머를 정리한다.
       * saveTimers/dirtySet 등 모듈 스코프 상태까지 청소해야 이전 사용자의
       * 예약된 서버 저장이 새 사용자 세션에서 발화하지 않는다.
       */
      reset: () => {
        for (const t of saveTimers.values()) clearTimeout(t);
        saveTimers.clear();
        dirtySet.clear();
        set({
          maps: {},
          activeMapId: null,
          lastActiveByMode: {},
          selectedNodeId: null,
          playingNodeId: null,
          ttsStatus: 'idle',
          lastSavedAt: null,
          syncStatus: {},
          lastServerSyncAt: {},
          isListLoading: false,
        });
      },
    }),
    {
      name: 'mindmap-store',
      version: 2,
      partialize: (state) => ({
        maps: state.maps,
        lastActiveByMode: state.lastActiveByMode,
      }),
      // v0 → v1: nodes 배열을 maps 객체로 승격
      // v1 → v2: 모든 노드에 description: '' 주입 (신규 필드)
      migrate: (persisted, version) => {
        let next = persisted;
        if (version === 0 && next.nodes) {
          const migrated = { maps: {}, lastActiveByMode: {} };
          if (next.nodes.length > 0) {
            const id = 'migrated-' + Date.now();
            migrated.maps[id] = {
              id,
              title: '마이그레이션 마인드맵',
              mode: 'general',
              nodes: next.nodes,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            migrated.lastActiveByMode.general = id;
          }
          next = migrated;
        }
        if (version < 2 && next?.maps) {
          const nextMaps = {};
          Object.entries(next.maps).forEach(([mapId, map]) => {
            nextMaps[mapId] = {
              ...map,
              nodes: (map.nodes || []).map((n) =>
                n.description == null ? { ...n, description: '' } : n,
              ),
            };
          });
          next = { ...next, maps: nextMaps };
        }
        return next;
      },
    },
  ),
);

export default useMindmapStore;
