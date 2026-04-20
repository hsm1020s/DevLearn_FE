/** @fileoverview 채팅 대화 및 메시지 상태 관리 스토어 (persist로 대화+메시지 영속화) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import {
  listConversations as apiListConversations,
  updateConversation as apiUpdateConversation,
  deleteConversations as apiDeleteConversations,
} from '../services/chatApi';
import { showError } from '../utils/errorHandler';

const useChatStore = create(
  persist(
    (set, get) => ({
      // 전체 대화 목록 (각 대화가 messages 배열을 포함)
      conversations: [],
      // 현재 활성 대화 ID
      currentConversationId: null,
      // LLM 응답 스트리밍 진행 중 여부
      isStreaming: false,
      // 서버 대화 목록 동기화 상태
      isConversationsLoading: false,
      conversationsError: null,
      lastSyncedAt: null,

      /**
       * 서버 대화 목록을 pull하여 로컬 conversations의 메타 필드만 merge한다.
       * 메시지 본문(c.messages)은 로컬 캐시를 유지하며, 서버 응답의
       * title/isFavorite/mode/llm/updatedAt만 덮어쓴다.
       * 서버에만 있고 로컬에 없던 대화는 messages:[]로 추가,
       * 로컬에만 있고 서버에 없는 대화(비로그인 시절 등)는 그대로 보존한다.
       */
      fetchConversations: async () => {
        set({ isConversationsLoading: true, conversationsError: null });
        try {
          const serverList = await apiListConversations();
          set((state) => {
            const localById = new Map(state.conversations.map((c) => [c.id, c]));
            const mergedIds = new Set();
            const merged = [];
            // 서버 목록 순으로 먼저 배치 (서버가 정렬 기준)
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
                // messages는 로컬 캐시 그대로 유지 (없으면 빈 배열)
                messages: local?.messages ?? [],
              });
            }
            // 서버에 없는 로컬 전용 대화는 뒤에 보존
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

      /** 새 대화를 생성하고 현재 대화로 설정 */
      createConversation: (mode, llm, title) => {
        const id = generateId();
        const conversation = {
          id,
          title: title || '새 채팅',
          mode,
          llm,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: id,
        }));
        return id;
      },

      /** 대화 전환 */
      setCurrentConversation: (id) => set({ currentConversationId: id }),

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
            // 첫 사용자 메시지면 대화 제목 자동 설정
            if (c.messages.length === 0 && message.role === 'user') {
              updated.title = message.content.slice(0, 30);
            }
            return updated;
          });
          return { conversations };
        });
        return msg;
      },

      setStreaming: (isStreaming) => set({ isStreaming }),

      /** 즐겨찾기 토글 — 로컬 갱신 후 서버에도 전파 */
      toggleFavorite: (id) => {
        const current = get().conversations.find((c) => c.id === id);
        const newValue = !(current?.isFavorite);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isFavorite: newValue } : c
          ),
        }));
        // 서버 동기화 (실패해도 로컬 상태는 유지)
        apiUpdateConversation(id, { isFavorite: newValue })
          .catch((err) => showError(err, '즐겨찾기 변경 실패'));
      },

      /** 대화 제목 변경 — 로컬 갱신 후 서버에도 전파 */
      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }));
        apiUpdateConversation(id, { title })
          .catch((err) => showError(err, '제목 변경 실패'));
      },

      /** 선택된 대화 ID 목록을 일괄 삭제 — 로컬 제거 후 서버에도 전파 */
      deleteConversations: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          conversations: state.conversations.filter((c) => !idSet.has(c.id)),
          currentConversationId: idSet.has(state.currentConversationId)
            ? null
            : state.currentConversationId,
        }));
        apiDeleteConversations(ids)
          .catch((err) => showError(err, '삭제 실패'));
      },

      clearMessages: () => set({ currentConversationId: null }),
    }),
    {
      name: 'chat-store',
      version: 2,
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      }),
      /** 이전 버전(messages가 전역 배열)에서 마이그레이션 */
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
          return persisted;
        } catch {
          return { conversations: [], currentConversationId: null };
        }
      },
    },
  ),
);

export default useChatStore;
