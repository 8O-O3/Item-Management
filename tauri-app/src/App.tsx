import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import Layout from '@/components/layout/Layout';

export default function App() {
  const loadData = useAppStore((s) => s.loadData);
  const selectProject = useAppStore((s) => s.selectProject);
  const projects = useAppStore((s) => s.projects);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadConfigs = useSettingsStore((s) => s.loadConfigs);
  const theme = useSettingsStore((s) => s.theme);
  const applyTheme = useSettingsStore((s) => s.applyTheme);

  // Initialize on mount
  useEffect(() => {
    async function init() {
      applyTheme();

      try {
        await loadData();
        await loadSessions();
        await loadConfigs();

        // Auto-migrate old localStorage settings
        const configs = useSettingsStore.getState().apiConfigs;
        if (configs.length === 0) {
          try {
            const old = localStorage.getItem('ai_settings');
            if (old) {
              const s = JSON.parse(old);
              if (s.apiKey && s.baseUrl && s.model) {
                const created = await useSettingsStore.getState().createConfig(
                  'Default', s.apiKey, s.baseUrl, s.model, s.systemPrompt || '',
                );
                if (created) {
                  useSettingsStore.getState().selectConfig(created.id!);
                }
                localStorage.removeItem('ai_settings');
              }
            }
          } catch { /* non-critical */ }
        }

        // Select first project
        const projs = useAppStore.getState().projects;
        if (projs.length > 0) {
          await selectProject(projs[0]);
        }
      } catch (e) {
        console.error('Init failed:', e);
      }

      // Show version
      try {
        const { systemApi } = await import('@/api');
        const version = await systemApi.getVersion();
        document.body.dataset.appVersion = 'v' + version;
      } catch { /* non-critical */ }
    }
    init();
  }, []);

  // Watch system theme changes for auto mode
  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() { applyTheme(); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, applyTheme]);

  // Global Escape to close modals
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        import('@/components/modals/modalStore').then((m) => m.closeModal());
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <Layout />;
}
