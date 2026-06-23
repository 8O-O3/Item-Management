export interface ApiConfig {
  id: number;
  name: string;
  api_key: string;
  base_url: string;
  model: string;
  system_prompt: string;
  created_at: string;
}

export interface CreateApiConfigArgs {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
}

export interface UpdateApiConfigArgs {
  id: number;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
}
