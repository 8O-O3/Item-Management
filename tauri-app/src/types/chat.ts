export interface ChatSession {
  id: number;
  title: string;
  model_config_id: number | null;
  context_json: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ChatContextSelections {
  folderIds: number[];
  projectIds: number[];
  nodeIds: number[];
}

export interface CreateChatSessionArgs {
  title: string;
  modelConfigId?: number | null;
  contextJson: string;
}

export interface UpdateChatSessionArgs {
  id: number;
  title: string;
  modelConfigId?: number | null;
  contextJson: string;
}

export interface AddChatMessageArgs {
  sessionId: number;
  role: string;
  content: string;
}
