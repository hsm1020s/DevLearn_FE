/** @fileoverview 채팅 대화 및 메시지 상태 관리 스토어 (persist로 대화+메시지 영속화) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useChatStore = create(
  persist(
    (set, get) => ({
      // 전체 대화 목록 (각 대화가 messages 배열을 포함)
      conversations: [],
      // 현재 활성 대화 ID
      currentConversationId: null,
      // LLM 응답 스트리밍 진행 중 여부
      isStreaming: false,

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

      /** 즐겨찾기 토글 */
      toggleFavorite: (id) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
          ),
        })),

      /** 대화 제목 변경 */
      renameConversation: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        })),

      /** 선택된 대화 ID 목록을 일괄 삭제 */
      deleteConversations: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          conversations: state.conversations.filter((c) => !idSet.has(c.id)),
          currentConversationId: idSet.has(state.currentConversationId)
            ? null
            : state.currentConversationId,
        }));
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
        if (version < 2) {
          const state = persisted;
          // 기존 conversations에 messages 배열이 없으면 빈 배열 추가
          if (state.conversations) {
            state.conversations = state.conversations.map((c) => ({
              ...c,
              messages: c.messages || [],
            }));
          }
        }
        return persisted;
      },
    },
  ),
);

export default useChatStore;
