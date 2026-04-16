import { create } from 'zustand';
import { generateId } from '../utils/helpers';

const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,

  createConversation: (mode) => {
    const id = generateId();
    const conversation = {
      id,
      title: '새 대화',
      mode,
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

  clearMessages: () => set({ messages: [], currentConversationId: null }),
}));

export default useChatStore;
