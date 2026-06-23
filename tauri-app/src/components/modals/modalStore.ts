import { create } from 'zustand';
import { useAppStore } from '@/stores/appStore';
import { foldersApi, projectsApi, nodesApi, chatApi } from '@/api';

type ModalType = 'folder' | 'project' | 'node' | 'file' | 'preview' | 'stats' | 'confirm' | null;

interface ConfirmData {
  message: string;
  dangerLabel?: string;
  onConfirm: () => void;
}

interface PreviewData {
  title: string;
  content: string; // HTML content
  downloadAction?: () => void;
}

interface ModalState {
  active: ModalType;
  editId: number | null; // non-null = editing
  confirmData: ConfirmData | null;
  previewData: PreviewData | null;
}

const modalStore = create<ModalState>(() => ({
  active: null,
  editId: null,
  confirmData: null,
  previewData: null,
}));

export function openModal(type: 'folder' | 'project' | 'node', editId?: number) {
  modalStore.setState({ active: type, editId: editId ?? null });
}

export function openFileModal(nodeIdx?: number) {
  modalStore.setState({ active: 'file', editId: nodeIdx ?? null });
}

export function openStatsModal() {
  modalStore.setState({ active: 'stats', editId: null });
}

export function openPreviewModal(title: string, content: string, downloadAction?: () => void) {
  modalStore.setState({ active: 'preview', previewData: { title, content, downloadAction } });
}

export function closeModal() {
  modalStore.setState({ active: null, editId: null, confirmData: null, previewData: null });
}

export function confirmDelete(type: string, id: number) {
  const store = useAppStore.getState();
  const name = type === 'folder'
    ? store.folders.find((f) => f.id === id)?.name
    : store.projects.find((p) => p.id === id)?.name ?? 'this project';

  modalStore.setState({
    active: 'confirm',
    confirmData: {
      message: `Delete "${name}"${type === 'project' ? ' and all its nodes' : ''}?`,
      dangerLabel: 'Delete',
      onConfirm: async () => {
        try {
          if (type === 'folder') {
            await foldersApi.deleteFolder(id);
          } else if (type === 'project') {
            await projectsApi.deleteProject(id);
          } else if (type === 'node') {
            await nodesApi.deleteNode(id);
          } else if (type === 'chat-session') {
            await chatApi.deleteChatSession(id);
          }
          await useAppStore.getState().loadData();
          const cp = useAppStore.getState().currentProject;
          if (type === 'project' && cp?.id === id) {
            useAppStore.setState({ currentProject: null, currentNodes: [] });
          } else if (cp) {
            await useAppStore.getState().refreshNodes();
          }
        } catch (e) {
          console.error(e);
        }
        closeModal();
      },
    },
  });
}

export { modalStore };
