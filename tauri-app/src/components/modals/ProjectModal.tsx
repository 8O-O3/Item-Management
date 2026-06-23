import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppStore } from '@/stores/appStore';
import { closeModal, modalStore } from './modalStore';
import { projectsApi } from '@/api';

export default function ProjectModal() {
  const active = modalStore((s) => s.active);
  const editId = modalStore((s) => s.editId);
  const folders = useAppStore((s) => s.folders);
  const projects = useAppStore((s) => s.projects);
  const loadData = useAppStore((s) => s.loadData);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);

  const isEditing = editId !== null;
  const editingProject = isEditing ? projects.find((p) => p.id === editId) : null;

  useEffect(() => {
    if (active === 'project') {
      if (editingProject) {
        setName(editingProject.name);
        setDesc(editingProject.desc ?? '');
        setFolderId(editingProject.folder_id);
      } else {
        setName('');
        setDesc('');
        setFolderId(null);
      }
    }
  }, [active, editingProject]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      if (isEditing && editId) {
        await projectsApi.updateProject(editId, name.trim(), desc.trim() || null, folderId);
      } else {
        await projectsApi.createProject(name.trim(), desc.trim() || null, folderId);
      }
      await loadData();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal open={active === 'project'} onClose={closeModal} title={isEditing ? 'Edit Project' : 'New Project'}>
      <select
        className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-3 cursor-pointer"
        value={folderId ?? ''}
        onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">No folder</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id!}>{f.name}</option>
        ))}
      </select>
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-3"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        autoFocus
      />
      <textarea
        className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-4 resize-none h-20"
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={closeModal}>Cancel</button>
        <button className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition" onClick={handleSubmit}>
          {isEditing ? 'Save' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}
