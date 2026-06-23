import { invoke } from './core';
import type { ChatSession, ChatMessage, CreateChatSessionArgs, UpdateChatSessionArgs, AddChatMessageArgs } from '@/types/chat';
import type { SearchResult } from '@/types/search';

export async function createChatSession(title: string, modelConfigId?: number | null, contextJson?: string): Promise<ChatSession> {
  return invoke<ChatSession>('create_chat_session', {
    title,
    modelConfigId,
    contextJson: contextJson ?? '{"folderIds":[],"projectIds":[],"nodeIds":[]}',
  } satisfies CreateChatSessionArgs);
}

export async function getChatSessions(): Promise<ChatSession[]> {
  return invoke<ChatSession[]>('get_chat_sessions');
}

export async function updateChatSession(id: number, title: string, modelConfigId?: number | null, contextJson?: string): Promise<void> {
  return invoke<void>('update_chat_session', { id, title, modelConfigId, contextJson: contextJson ?? '' } satisfies UpdateChatSessionArgs);
}

export async function deleteChatSession(id: number): Promise<void> {
  return invoke<void>('delete_chat_session', { id });
}

export async function addChatMessage(sessionId: number, role: string, content: string): Promise<ChatMessage> {
  return invoke<ChatMessage>('add_chat_message', { sessionId, role, content } satisfies AddChatMessageArgs);
}

export async function getChatMessages(sessionId: number): Promise<ChatMessage[]> {
  return invoke<ChatMessage[]>('get_chat_messages', { sessionId });
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('search_all', { query });
}

export async function callAiStream(apiKey: string, baseUrl: string, model: string, messagesJson: string): Promise<void> {
  return invoke<void>('call_ai_stream', { apiKey, baseUrl, model, messagesJson });
}

export async function cancelAiStream(): Promise<void> {
  return invoke<void>('cancel_ai_stream');
}

export async function callAiApi(apiKey: string, baseUrl: string, model: string, messagesJson: string): Promise<string> {
  return invoke<string>('call_ai_api', { apiKey, baseUrl, model, messagesJson });
}
