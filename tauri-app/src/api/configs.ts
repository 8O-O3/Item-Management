import { invoke } from './core';
import type { ApiConfig, CreateApiConfigArgs, UpdateApiConfigArgs } from '@/types/api-config';

export async function getApiConfigs(): Promise<ApiConfig[]> {
  return invoke<ApiConfig[]>('get_api_configs');
}

export async function createApiConfig(
  name: string, apiKey: string, baseUrl: string, model: string, systemPrompt?: string,
): Promise<ApiConfig> {
  return invoke<ApiConfig>('create_api_config', { name, apiKey, baseUrl, model, systemPrompt } satisfies CreateApiConfigArgs);
}

export async function updateApiConfig(
  id: number, name: string, apiKey: string, baseUrl: string, model: string, systemPrompt?: string,
): Promise<void> {
  return invoke<void>('update_api_config', { id, name, apiKey, baseUrl, model, systemPrompt } satisfies UpdateApiConfigArgs);
}

export async function deleteApiConfig(id: number): Promise<void> {
  return invoke<void>('delete_api_config', { id });
}
