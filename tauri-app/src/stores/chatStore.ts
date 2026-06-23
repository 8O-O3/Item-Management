import { create } from 'zustand';
import type { ChatSession, ChatMessage, ChatContextSelections } from '@/types/chat';
import * as chatApi from '@/api/chat';
import type { ApiConfig } from '@/types/api-config';
import type { Project } from '@/types';

interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  data: string;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  isPanelOpen: boolean;
  contextSelections: ChatContextSelections;
  attachments: ChatAttachment[];
  contextNodesCache: Record<number, import('@/types/node').Node[]>;

  // Actions
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: number) => Promise<void>;
  newSession: (project?: Project) => void;
  sendMessage: (text: string, config: ApiConfig) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContextSelections: (sel: ChatContextSelections) => void;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (idx: number) => void;
}

let streamUnlisten: (() => void) | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  isPanelOpen: false,
  contextSelections: { folderIds: [], projectIds: [], nodeIds: [] },
  attachments: [],
  contextNodesCache: {},

  loadSessions: async () => {
    try {
      const sessions = await chatApi.getChatSessions();
      set({ sessions });
    } catch {
      // non-critical
    }
  },

  loadSession: async (sessionId) => {
    try {
      const messages = await chatApi.getChatMessages(sessionId);
      const session = get().sessions.find((s) => s.id === sessionId);
      let contextSelections = get().contextSelections;
      if (session?.context_json) {
        try {
          contextSelections = JSON.parse(session.context_json);
        } catch {
          // keep defaults
        }
      }
      set({
        messages: messages.map((m) => ({ ...m, role: m.role as ChatMessage['role'] })),
        currentSessionId: sessionId,
        contextSelections,
      });
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  },

  newSession: (project) => {
    const contextSelections: ChatContextSelections = project
      ? { folderIds: [], projectIds: [project.id], nodeIds: [] }
      : { folderIds: [], projectIds: [], nodeIds: [] };
    set({
      messages: [],
      currentSessionId: null,
      contextSelections,
      attachments: [],
    });
  },

  sendMessage: async (text, config) => {
    const state = get();
    if (state.isLoading) return;

    let sessionId = state.currentSessionId;

    // Create session if needed
    if (!sessionId) {
      try {
        const title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        const session = await chatApi.createChatSession(title, config.id, JSON.stringify(state.contextSelections));
        set({ sessions: [session, ...state.sessions], currentSessionId: session.id });
        sessionId = session.id;
      } catch (e) {
        console.error('Failed to create session:', e);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...state.messages, userMsg];
    set({ messages: newMessages, isLoading: true, isStreaming: true });

    // Save user message to DB (fire-and-forget)
    chatApi.addChatMessage(sessionId, 'user', text).catch(() => {});

    try {
      // Build API messages with context
      const apiMessages: Array<{ role: string; content: string }> = [];
      let systemContent = config.system_prompt || 'You are a helpful assistant.';

      // Build context text (simplified - full version would fetch nodes)
      const sel = state.contextSelections;
      if (sel.projectIds.length > 0 || sel.nodeIds.length > 0) {
        systemContent += '\n\n=== SELECTED CONTEXT ===\n';
        if (sel.projectIds.length > 0) {
          systemContent += `Projects selected: ${sel.projectIds.join(', ')}\n`;
        }
        if (sel.nodeIds.length > 0) {
          systemContent += `Nodes selected: ${sel.nodeIds.join(', ')}\n`;
        }
        systemContent += '\nUse this context to answer user questions.';
      }

      apiMessages.push({ role: 'system', content: systemContent });

      const historyStart = Math.max(0, newMessages.length - 21);
      for (let i = historyStart; i < newMessages.length; i++) {
        apiMessages.push({ role: newMessages[i].role, content: newMessages[i].content });
      }

      // Set up stream listeners
      let streamedContent = '';
      const unlistenChunk = await window.__TAURI__?.event.listen<{ content: string }>('ai-chunk', (event) => {
        streamedContent += event.payload.content;
        // Update streaming message
        set((s) => {
          const msgs = [...s.messages];
          const lastIdx = msgs.length - 1;
          if ((msgs[lastIdx]?.role as string) === 'assistant-streaming') {
            msgs[lastIdx] = { ...msgs[lastIdx], content: streamedContent };
          } else {
            msgs.push({
              id: Date.now(),
              session_id: sessionId,
              role: 'assistant-streaming' as ChatMessage['role'],
              content: streamedContent,
              created_at: new Date().toISOString(),
            });
          }
          return { messages: msgs };
        });
      });

      const unlistenDone = await window.__TAURI__?.event.listen<{ error: string | null }>('ai-done', (event) => {
        unlistenChunk?.();
        unlistenDone?.();
        streamUnlisten = null;

        set((s) => {
          const msgs = s.messages.filter((m) => (m.role as string) !== 'assistant-streaming');
          if (event.payload.error === 'cancelled') {
            if (streamedContent.trim()) {
              msgs.push({
                id: Date.now(),
                session_id: sessionId,
                role: 'assistant',
                content: streamedContent + '\n\n[Stopped]',
                created_at: new Date().toISOString(),
              });
            }
          } else {
            msgs.push({
              id: Date.now(),
              session_id: sessionId,
              role: 'assistant',
              content: streamedContent,
              created_at: new Date().toISOString(),
            });
          }
          return { messages: msgs, isLoading: false, isStreaming: false };
        });

        // Save assistant message to DB
        if (streamedContent.trim()) {
          const finalContent = event.payload.error === 'cancelled'
            ? streamedContent + '\n\n[Stopped]'
            : streamedContent;
          chatApi.addChatMessage(sessionId!, 'assistant', finalContent).catch(() => {});
        }
      });

      streamUnlisten = () => {
        unlistenChunk?.();
        unlistenDone?.();
        streamUnlisten = null;
      };

      await chatApi.callAiStream(config.api_key, config.base_url, config.model, JSON.stringify(apiMessages));
    } catch (e) {
      set((s) => ({
        messages: [
          ...s.messages.filter((m) => (m.role as string) !== 'assistant-streaming'),
          {
            id: Date.now(),
            session_id: sessionId!,
            role: 'assistant',
            content: 'Error: ' + String(e),
            created_at: new Date().toISOString(),
          },
        ],
        isLoading: false,
        isStreaming: false,
      }));
    }
  },

  stopStreaming: () => {
    chatApi.cancelAiStream().catch(() => {});
    if (streamUnlisten) {
      streamUnlisten();
      streamUnlisten = null;
    }
    set({ isLoading: false, isStreaming: false });
  },

  clearChat: () => {
    set({
      messages: [],
      currentSessionId: null,
      contextSelections: { folderIds: [], projectIds: [], nodeIds: [] },
      attachments: [],
    });
  },

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  setContextSelections: (sel) => set({ contextSelections: sel }),

  addAttachment: async (file) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        set((s) => ({
          attachments: [...s.attachments, {
            name: file.name,
            size: file.size,
            type: file.type,
            data: reader.result as string,
          }],
        }));
        resolve();
      };
      reader.readAsDataURL(file);
    });
  },

  removeAttachment: (idx) => {
    set((s) => ({
      attachments: s.attachments.filter((_, i) => i !== idx),
    }));
  },
}));
