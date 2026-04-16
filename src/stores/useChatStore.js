/** @fileoverview 채팅 대화 및 메시지 상태 관리 스토어 (persist로 대화 목록 영속화) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';

const useChatStore = create(
  persist(
    (set, get) => ({
      // 전체 대화 목록
      conversations: [],
      // 현재 활성 대화 ID
      currentConversationId: null,
      // 현재 대화의 메시지 배열
      messages: [],
      // LLM 응답 스트리밍 진행 중 여부
      isStreaming: false,

      /** 새 대화를 생성하고 현재 대화로 설정 */
      createConversation: (mode, llm, title) => {
        const id = generateId();
        const conversation = {
          id,
          title: title || '새 채팅',
          mode,
          llm, // 대화 생성 시 선택된 LLM 모델
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: id,
          messages: [],
        }));
        return id;
      },

      setCurrentConversation: (id) => set({ currentConversationId: id }),

      /** 메시지를 추가하고, 첫 사용자 메시지일 경우 대화 제목을 자동 설정 */
      addMessage: (message) => {
        const msg = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          ...message,
        };
        set((state) => {
          const updated = [...state.messages, msg];
          const title = state.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 30)
            : null;
          const conversations = title
            ? state.conversations.map((c) =>
                c.id === state.currentConversationId
                  ? { ...c, title, updatedAt: new Date().toISOString() }
                  : c
              )
            : state.conversations;
          return { messages: updated, conversations };
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
          messages: idSet.has(state.currentConversationId) ? [] : state.messages,
        }));
      },

      clearMessages: () => set({ messages: [], currentConversationId: null }),
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        conversations: state.conversations,
      }),
    },
  ),
);

export default useChatStore;
