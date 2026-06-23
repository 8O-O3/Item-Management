import Modal from './Modal';
import { closeModal, modalStore } from './modalStore';

export default function PreviewModal() {
  const active = modalStore((s) => s.active);
  const data = modalStore((s) => s.previewData);

  return (
    <Modal open={active === 'preview'} onClose={closeModal} title={data?.title ?? 'Preview'} wide>
      <div className="text-center mb-4" dangerouslySetInnerHTML={{ __html: data?.content ?? '' }} />
      <div className="flex justify-end gap-2">
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={closeModal}>Close</button>
        {data?.downloadAction && (
          <button className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition" onClick={data.downloadAction}>Download</button>
        )}
      </div>
    </Modal>
  );
}
