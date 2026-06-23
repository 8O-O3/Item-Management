import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  editingId: number | null;
  onClose: () => void;
}

export default function ApiConfigForm({ editingId, onClose }: Props) {
  const configs = useSettingsStore((s) => s.apiConfigs);
  const createConfig = useSettingsStore((s) => s.createConfig);
  const updateConfig = useSettingsStore((s) => s.updateConfig);

  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const isEditing = editingId != null && editingId > 0;
  const existing = isEditing ? configs.find((c) => c.id === editingId) : null;

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setApiKey(existing.api_key);
      setBaseUrl(existing.base_url);
      setModel(existing.model);
      setSystemPrompt(existing.system_prompt);
    } else {
      setName('');
      setApiKey('');
      setBaseUrl('');
      setModel('');
      setSystemPrompt('');
    }
  }, [existing, editingId]);

  if (editingId === null) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !apiKey.trim() || !baseUrl.trim() || !model.trim()) return;
    try {
      if (isEditing && editingId) {
        await updateConfig(editingId, name.trim(), apiKey.trim(), baseUrl.trim(), model.trim(), systemPrompt.trim());
      } else {
        const created = await createConfig(name.trim(), apiKey.trim(), baseUrl.trim(), model.trim(), systemPrompt.trim());
        if (created) useSettingsStore.getState().selectConfig(created.id!);
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">Name</span>
        <input className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition" placeholder="My Config" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">API Key</span>
        <input className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">Base URL</span>
        <input className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition" placeholder="https://api.openai.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">Model</span>
        <input className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition" placeholder="gpt-4o" value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">System Prompt (optional)</span>
        <textarea className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition resize-none h-20" placeholder="You are a helpful assistant." value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={onClose}>Cancel</button>
        <button className="px-4 py-2 rounded-lg text-sm bg-accent text-white font-medium hover:bg-accent-hover transition shadow-sm" onClick={handleSubmit}>
          {isEditing ? 'Save Changes' : 'Create Config'}
        </button>
      </div>
    </div>
  );
}
