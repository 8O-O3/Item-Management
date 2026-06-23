import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppStore } from '@/stores/appStore';
import { closeModal, modalStore } from './modalStore';
import { nodesApi } from '@/api';

export default function NodeModal() {
  const active = modalStore((s) => s.active);
  const editId = modalStore((s) => s.editId);
  const currentNodes = useAppStore((s) => s.currentNodes);
  const currentProject = useAppStore((s) => s.currentProject);
  const refreshNodes = useAppStore((s) => s.refreshNodes);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const isEditing = editId !== null;
  const editingNode = isEditing ? currentNodes.find((n) => n.id === editId) : null;

  useEffect(() => {
    if (active === 'node') {
      if (editingNode) {
        setTitle(editingNode.title);
        setDesc(editingNode.desc ?? '');
      } else {
        setTitle('');
        setDesc('');
      }
    }
  }, [active, editingNode]);

  const handleSubmit = async () => {
    if (!title.trim() || !currentProject?.id) return;
    try {
      if (isEditing && editId) {
        await nodesApi.updateNode(editId, title.trim(), desc.trim() || null);
      } else {
        await nodesApi.createNode(currentProject.id, title.trim(), desc.trim() || null);
      }
      await refreshNodes();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal open={active === 'node'} onClose={closeModal} title={isEditing ? 'Edit Node' : 'Add Node'}>
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg text-sm bg-bg border border-border text-text outline-none focus:border-accent mb-3"
        placeholder="Node name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
          {isEditing ? 'Save' : 'Add'}
        </button>
      </div>
    </Modal>
  );
}
