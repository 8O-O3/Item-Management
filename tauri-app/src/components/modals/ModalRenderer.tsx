import FolderModal from './FolderModal';
import ProjectModal from './ProjectModal';
import NodeModal from './NodeModal';
import FileModal from './FileModal';
import PreviewModal from './PreviewModal';
import StatsModal from './StatsModal';
import ConfirmModal from './ConfirmModal';

export default function ModalRenderer() {
  return (
    <>
      <FolderModal />
      <ProjectModal />
      <NodeModal />
      <FileModal />
      <PreviewModal />
      <StatsModal />
      <ConfirmModal />
    </>
  );
}
