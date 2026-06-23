import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppStore } from '@/stores/appStore';
import { closeModal, modalStore } from './modalStore';
import { foldersApi } from '@/api';

export default function FolderModal() {
  const active = modalStore((s) => s.active);
  const editId = modalStore((s) => s.editId);
  const folders = useAppStore((s) => s.folders);
  const loadData = useAppStore((s) => s.loadData);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);

  const isEditing = editId !== null;
  const editingFolder = isEditing ? folders.find((f) => f.id === editId) : null;

  useEffect(() => {
    if (active === 'folder') {
      if (editingFolder) {
        setName(editingFolder.name);
        setParentId(editingFolder.parent_id);
      } else {
        setName('');
        setParentId(null);
      }
    }
  }, [active, editingFolder]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      if (isEditing && editId) {
        await foldersApi.updateFolder(editId, name.trim());
      } else {
        await foldersApi.createFolder(name.trim(), parentId);
      }
      await loadData();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal open={active === 'folder'} onClose={closeModal} title={isEditing ? 'Rename Folder' : 'New Folder'}>
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-3"
        placeholder="Folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        autoFocus
      />
      {!isEditing && (
        <select
          className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-4 cursor-pointer"
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">No parent (root)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id!}>{f.name}</option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={closeModal}>Cancel</button>
        <button className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition" onClick={handleSubmit}>
          {isEditing ? 'Save' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}
