import Modal from './Modal';
import { closeModal, modalStore } from './modalStore';
import { useAppStore } from '@/stores/appStore';
import { systemApi } from '@/api';

import { useChatStore } from '@/stores/chatStore';

export default function StatsModal() {
  const active = modalStore((s) => s.active);
  const folders = useAppStore((s) => s.folders);
  const projects = useAppStore((s) => s.projects);
  const currentNodes = useAppStore((s) => s.currentNodes);
  const chatSessions = useChatStore((s) => s.sessions);

  const totalNodes = currentNodes.length;
  const totalFiles = currentNodes.reduce((sum, n) => sum + (n.files?.length ?? 0), 0);
  const totalTimelines = currentNodes.reduce((sum, n) => sum + (n.timeline?.length ?? 0), 0);

  return (
    <Modal open={active === 'stats'} onClose={closeModal} title="Statistics" wide>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Folders" value={folders.length} />
        <Stat label="Projects" value={projects.length} />
        <Stat label="Nodes" value={totalNodes} />
        <Stat label="Files" value={totalFiles} />
        <Stat label="Timeline Entries" value={totalTimelines} />
        <Stat label="Chat Sessions" value={chatSessions.length} />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={() => systemApi.openAppDir()}>Open Data Folder</button>
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={closeModal}>Close</button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-xs text-text-secondary mt-1">{label}</div>
    </div>
  );
}
