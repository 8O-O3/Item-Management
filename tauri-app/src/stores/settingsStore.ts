import { create } from 'zustand';
import type { ApiConfig } from '@/types/api-config';
import * as configsApi from '@/api/configs';

type Theme = 'light' | 'dark' | 'auto';

interface SettingsState {
  apiConfigs: ApiConfig[];
  selectedApiConfigId: number | null;
  editingConfigId: number | null;
  theme: Theme;

  loadConfigs: () => Promise<void>;
  selectConfig: (id: number) => void;
  setEditingConfig: (id: number | null) => void;
  createConfig: (name: string, apiKey: string, baseUrl: string, model: string, systemPrompt?: string) => Promise<ApiConfig | null>;
  updateConfig: (id: number, name: string, apiKey: string, baseUrl: string, model: string, systemPrompt?: string) => Promise<void>;
  deleteConfig: (id: number) => Promise<void>;
  setTheme: (theme: Theme) => void;
  applyTheme: () => void;
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // auto — follow system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiConfigs: [],
  selectedApiConfigId: null,
  editingConfigId: null,
  theme: (localStorage.getItem('theme') as Theme) || 'auto',

  loadConfigs: async () => {
    try {
      const configs = await configsApi.getApiConfigs();
      set({ apiConfigs: configs });
      if (!get().selectedApiConfigId && configs.length > 0) {
        set({ selectedApiConfigId: configs[0].id });
      }
    } catch {
      // non-critical
    }
  },

  selectConfig: (id) => set({ selectedApiConfigId: id }),

  setEditingConfig: (id) => set({ editingConfigId: id }),

  createConfig: async (name, apiKey, baseUrl, model, systemPrompt) => {
    try {
      const config = await configsApi.createApiConfig(name, apiKey, baseUrl, model, systemPrompt);
      set((s) => ({ apiConfigs: [...s.apiConfigs, config] }));
      return config;
    } catch (e) {
      console.error('Failed to create config:', e);
      return null;
    }
  },

  updateConfig: async (id, name, apiKey, baseUrl, model, systemPrompt) => {
    await configsApi.updateApiConfig(id, name, apiKey, baseUrl, model, systemPrompt);
    set((s) => ({
      apiConfigs: s.apiConfigs.map((c) =>
        c.id === id ? { ...c, name, api_key: apiKey, base_url: baseUrl, model, system_prompt: systemPrompt ?? '' } : c,
      ),
    }));
  },

  deleteConfig: async (id) => {
    await configsApi.deleteApiConfig(id);
    set((s) => ({
      apiConfigs: s.apiConfigs.filter((c) => c.id !== id),
      selectedApiConfigId: s.selectedApiConfigId === id ? (s.apiConfigs[0]?.id ?? null) : s.selectedApiConfigId,
    }));
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
    applyThemeToDom(theme);
  },

  applyTheme: () => {
    applyThemeToDom(get().theme);
  },
}));
