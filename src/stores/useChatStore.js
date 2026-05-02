/** @fileoverview 채팅 대화 및 메시지 상태 관리 스토어 (persist로 대화+메시지 영속화)
 *
 * isLocal 플래그로 서버 동기화 여부를 추적한다.
 * - createConversation: 로컬 즉시 추가 + isLocal:true, 백그라운드로 서버 eager 생성
 * - reconcileConversation(id): 서버 승격 시 isLocal:false로 전환 + 로컬에서 대기 중이던
 *   isFavorite/title 패치를 1회 flush (fire-and-forget)
 * - toggleFavorite/rename/delete: isLocal이면 서버 호출을 스킵해 404 토스트를 차단
 * - fetchConversations: 서버 목록에 존재하는 id는 isLocal:false로 확정
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import {
  createConversation as apiCreateConversation,
  listConversations as apiListConversations,
  updateConversation as apiUpdateConversation,
  deleteConversations as apiDeleteConversations,
} from '../services/chatApi';
import { showError } from '../utils/errorHandler';
import useAuthStore from './useAuthStore';

const useChatStore = create(
  persist(
    (set, get) => ({
      // 전체 대화 목록 (각 대화가 messages 배열을 포함)
      conversations: [],
      // 현재 활성 대화 ID
      currentConversationId: null,
      // 모드별 마지막으로 보던 대화 id — 모드 전환 시 자동 복원용
      lastActiveByMode: { general: null, study: null, worklearn: null },
      // 학습 계열 모드의 좌우 분할 채팅 슬롯 — 좌(일반)/우(파인만) 각각 독립 conv id를 보관
      splitConversationIds: {
        study: { left: null, right: null },
        worklearn: { left: null, right: null },
      },
      // LLM 응답 스트리밍 진행 중 여부
      isStreaming: false,
      // 서버 대화 목록 동기화 상태
      isConversationsLoading: false,
      conversationsError: null,
      lastSyncedAt: null,

      /**
       * 서버 대화 목록을 pull하여 로컬 conversations의 메타 필드만 merge한다.
       * 메시지 본문(c.messages)은 로컬 캐시를 유지하며, 서버 응답의
       * title/isFavorite/mode/llm/updatedAt만 덮어쓴다. 서버 목록에 존재하면
       * isLocal:false로 확정하고, 서버에만 있고 로컬에 없던 대화는 messages:[]로 추가,
       * 로컬에만 있고 서버에 없는 대화는 그대로 보존한다.
       */
      fetchConversations: async () => {
        set({ isConversationsLoading: true, conversationsError: null });
        try {
          const serverList = await apiListConversations();
          set((state) => {
            const localById = new Map(state.conversations.map((c) => [c.id, c]));
            const mergedIds = new Set();
            const merged = [];
            for (const s of serverList) {
              mergedIds.add(s.id);
              const local = localById.get(s.id);
              merged.push({
                ...(local ?? { messages: [] }),
                id: s.id,
                title: s.title,
                isFavorite: s.isFavorite ?? local?.isFavorite ?? false,
                mode: s.mode ?? local?.mode,
                llm: s.llm ?? local?.llm,
                createdAt: s.createdAt ?? local?.createdAt,
                updatedAt: s.updatedAt ?? local?.updatedAt,
                messages: local?.messages ?? [],
                // 서버 목록에 존재 → 서버 동기화 확정
                isLocal: false,
              });
            }
            for (const local of state.conversations) {
              if (!mergedIds.has(local.id)) merged.push(local);
            }
            return {
              conversations: merged,
              isConversationsLoading: false,
              lastSyncedAt: new Date().toISOString(),
            };
          });
        } catch (err) {
          set({ isConversationsLoading: false, conversationsError: err });
          showError(err, '대화 목록을 불러오지 못했습니다');
        }
      },

      /**
       * 새 대화를 생성하고 현재 대화로 설정.
       * 로컬에 isLocal:true로 즉시 추가한 뒤, 로그인 상태라면 백그라운드로
       * 서버 eager 생성을 시도해 성공 시 isLocal을 false로 전환한다.
       */
      createConversation: (mode, llm, title) => {
        const id = generateId();
        const conversation = {
          id,
          title: title || '새 채팅',
          mode,
          llm,
          messages: [],
          isFavorite: false,
          isLocal: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: id,
        }));

        // 로그인 상태에서만 서버 사전 등록 시도 — 실패해도 로컬은 유지,
        // 이후 첫 stream 완료 시 reconcileConversation가 승격시킨다.
        if (useAuthStore.getState().isLoggedIn) {
          apiCreateConversation({ id, mode, llm, title: conversation.title, isFavorite: false })
            .then(() => get().reconcileConversation(id))
            .catch(() => { /* silent — 다음 메시지 전송 시 stream 경로에서 서버 생성됨 */ });
        }
        return id;
      },

      /**
       * 서버에 확실히 존재하는 대화임을 표시하고, 로컬에서 서버 미반영 상태로
       * 누적된 isFavorite/title 값이 있으면 한 번에 서버에 flush한다.
       */
      reconcileConversation: (id) => {
        const conv = get().conversations.find((c) => c.id === id);
        if (!conv || conv.isLocal === false) return;
        // 먼저 isLocal 해제
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isLocal: false } : c
          ),
        }));
        // 로컬 동안 쌓인 변경(기본값과 다른 필드)이 있으면 서버에 flush
        const patch = {};
        if (conv.isFavorite === true) patch.isFavorite = true;
        if (conv.title && conv.title !== '새 채팅') patch.title = conv.title;
        if (Object.keys(patch).length === 0) return;
        apiUpdateConversation(id, patch).catch(() => { /* 다음 기회에 재시도 */ });
      },

      /**
       * 대화 전환 — currentConversationId 갱신 + 해당 대화 mode의 lastActive 슬롯에 기록.
       * null 전달 시 currentConversationId만 해제(슬롯은 변경하지 않음 — 모드 복귀 시 복원용).
       */
      setCurrentConversation: (id) => {
        if (id == null) {
          set({ currentConversationId: null });
          return;
        }
        const conv = get().conversations.find((c) => c.id === id);
        set((state) => ({
          currentConversationId: id,
          lastActiveByMode: conv?.mode
            ? { ...state.lastActiveByMode, [conv.mode]: id }
            : state.lastActiveByMode,
        }));
      },

      /**
       * 모드 전환 시 호출 — 현재 대화 id를 이전 모드 슬롯에 저장하고,
       * 새 모드의 마지막 대화를 currentConversationId로 복원한다.
       * 복원 대상이 존재하지 않으면 null(EmptyChatView 노출).
       */
      switchMode: (newMode) => {
        set((state) => {
          const currentId = state.currentConversationId;
          const currentConv = state.conversations.find((c) => c.id === currentId);
          const prevMode = currentConv?.mode;
          const nextSlots = prevMode
            ? { ...state.lastActiveByMode, [prevMode]: currentId }
            : state.lastActiveByMode;
          const candidate = nextSlots[newMode];
          const restored = state.conversations.some((c) => c.id === candidate && c.mode === newMode)
            ? candidate
            : null;
          return {
            lastActiveByMode: restored ? nextSlots : { ...nextSlots, [newMode]: null },
            currentConversationId: restored,
          };
        });
      },

      /** 메시지를 현재 대화에 추가하고, 첫 사용자 메시지일 경우 대화 제목을 자동 설정 */
      addMessage: (message) => {
        const msg = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          ...message,
        };
        set((state) => {
          const conversations = state.conversations.map((c) => {
            if (c.id !== state.currentConversationId) return c;
            const updated = { ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() };
            if (c.messages.length === 0 && message.role === 'user') {
              updated.title = message.content.slice(0, 30);
            }
            return updated;
          });
          return { conversations };
        });
        return msg;
      },

      /**
       * 특정 대화 id에 메시지를 추가. split 모드에서 currentConversationId 우회용.
       * 좌·우 패널이 동시에 다른 대화를 사용해야 하는 학습 워크스페이스에서 사용한다.
       */
      addMessageTo: (conversationId, message) => {
        if (!conversationId) return null;
        const msg = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          ...message,
        };
        set((state) => {
          const conversations = state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const updated = { ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() };
            if (c.messages.length === 0 && message.role === 'user') {
              updated.title = message.content.slice(0, 30);
            }
            return updated;
          });
          return { conversations };
        });
        return msg;
      },

      /**
       * split 워크스페이스 전용 대화 생성. 일반 createConversation과 달리
       * `currentConversationId`를 변경하지 않으므로, 좌·우 패널이 서로의 활성 대화를
       * 침범하지 않는다. 생성과 동시에 splitConversationIds[mode][paneKey]에 할당.
       */
      createSplitConversation: (mode, llm, paneKey, title) => {
        const id = generateId();
        const conversation = {
          id,
          title: title || '새 채팅',
          mode,
          llm,
          messages: [],
          isFavorite: false,
          isLocal: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          splitConversationIds: {
            ...state.splitConversationIds,
            [mode]: {
              ...(state.splitConversationIds[mode] || { left: null, right: null }),
              [paneKey]: id,
            },
          },
        }));
        if (useAuthStore.getState().isLoggedIn) {
          apiCreateConversation({ id, mode, llm, title: conversation.title, isFavorite: false })
            .then(() => get().reconcileConversation(id))
            .catch(() => { /* silent — 다음 stream 완료 시 승격 */ });
        }
        return id;
      },

      /** split 워크스페이스의 좌/우 슬롯에 conv id 할당. */
      setSplitConversationId: (mode, paneKey, id) =>
        set((state) => ({
          splitConversationIds: {
            ...state.splitConversationIds,
            [mode]: {
              ...(state.splitConversationIds[mode] || { left: null, right: null }),
              [paneKey]: id,
            },
          },
        })),

      /** split 슬롯 비우기 — 파인만 종료 시 우측 슬롯을 null로 되돌릴 때 사용. */
      clearSplitConversation: (mode, paneKey) =>
        set((state) => ({
          splitConversationIds: {
            ...state.splitConversationIds,
            [mode]: {
              ...(state.splitConversationIds[mode] || { left: null, right: null }),
              [paneKey]: null,
            },
          },
        })),

      setStreaming: (isStreaming) => set({ isStreaming }),

      /** 즐겨찾기 토글 — 로컬 갱신 후 isLocal 아닐 때만 서버 전파 */
      toggleFavorite: (id) => {
        const current = get().conversations.find((c) => c.id === id);
        const newValue = !(current?.isFavorite);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isFavorite: newValue } : c
          ),
        }));
        if (current?.isLocal) return; // 서버에 아직 없는 대화 — 승격 시 flush됨
        apiUpdateConversation(id, { isFavorite: newValue })
          .catch((err) => showError(err, '즐겨찾기 변경 실패'));
      },

      /** 대화 제목 변경 — 로컬 갱신 후 isLocal 아닐 때만 서버 전파 */
      renameConversation: (id, title) => {
        const current = get().conversations.find((c) => c.id === id);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }));
        if (current?.isLocal) return;
        apiUpdateConversation(id, { title })
          .catch((err) => showError(err, '제목 변경 실패'));
      },

      /** 선택된 대화 ID 목록을 일괄 삭제 — 로컬 제거 후 서버에 존재하던 것만 DELETE */
      deleteConversations: (ids) => {
        const idSet = new Set(ids);
        const serverIds = get().conversations
          .filter((c) => idSet.has(c.id) && c.isLocal !== true)
          .map((c) => c.id);
        set((state) => {
          const cleanedSlots = Object.fromEntries(
            Object.entries(state.lastActiveByMode).map(([mode, id]) => [
              mode,
              idSet.has(id) ? null : id,
            ]),
          );
          return {
            conversations: state.conversations.filter((c) => !idSet.has(c.id)),
            currentConversationId: idSet.has(state.currentConversationId)
              ? null
              : state.currentConversationId,
            lastActiveByMode: cleanedSlots,
          };
        });
        if (serverIds.length === 0) return;
        apiDeleteConversations(serverIds)
          .catch((err) => showError(err, '삭제 실패'));
      },

      clearMessages: () => set({ currentConversationId: null }),

      /**
       * 로그아웃 시 호출 — 사용자별 로컬 캐시를 완전 초기화한다.
       * 스트리밍 중이었다면 UI는 이미 unmount되므로 상태만 리셋.
       */
      reset: () => set({
        conversations: [],
        currentConversationId: null,
        lastActiveByMode: { general: null, study: null, worklearn: null },
        splitConversationIds: {
          study: { left: null, right: null },
          worklearn: { left: null, right: null },
        },
        isStreaming: false,
        isConversationsLoading: false,
        conversationsError: null,
        lastSyncedAt: null,
      }),
    }),
    {
      name: 'chat-store',
      version: 5,
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        lastActiveByMode: state.lastActiveByMode,
        splitConversationIds: state.splitConversationIds,
      }),
      /**
       * 마이그레이션:
       * - v1 → v2: messages가 전역 배열 → 대화별 배열 구조로 이관
       * - v2 → v3: lastActiveByMode 기본값 주입 `{general, study}`
       * - v3 → v4: lastActiveByMode 에 `worklearn` 슬롯 추가 (업무학습 모드 도입)
       * - v4 → v5: 학습 워크스페이스 좌우 분할 도입 — splitConversationIds 슬롯 주입
       */
      migrate: (persisted, version) => {
        try {
          if (version < 2) {
            const state = persisted;
            if (Array.isArray(state.conversations)) {
              state.conversations = state.conversations.map((c) => ({
                ...c,
                messages: Array.isArray(c.messages) ? c.messages : [],
              }));
            } else {
              state.conversations = [];
            }
          }
          if (version < 3) {
            persisted.lastActiveByMode = { general: null, study: null, worklearn: null };
          }
          if (version < 4) {
            // v3은 {general, study}만 가진 객체였을 수 있음 — worklearn 슬롯 추가.
            persisted.lastActiveByMode = {
              general: null,
              study: null,
              worklearn: null,
              ...(persisted.lastActiveByMode || {}),
            };
          }
          if (version < 5) {
            // 좌우 분할 도입 — 빈 슬롯으로 초기화. 기존 대화 데이터에는 영향 없음.
            persisted.splitConversationIds = {
              study: { left: null, right: null },
              worklearn: { left: null, right: null },
              ...(persisted.splitConversationIds || {}),
            };
          }
          return persisted;
        } catch {
          return {
            conversations: [],
            currentConversationId: null,
            lastActiveByMode: { general: null, study: null, worklearn: null },
            splitConversationIds: {
              study: { left: null, right: null },
              worklearn: { left: null, right: null },
            },
          };
        }
      },
    },
  ),
);

export default useChatStore;
