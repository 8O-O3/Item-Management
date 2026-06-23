import Modal from './Modal';
import { closeModal, modalStore } from './modalStore';

export default function ConfirmModal() {
  const active = modalStore((s) => s.active);
  const data = modalStore((s) => s.confirmData);

  return (
    <Modal open={active === 'confirm'} onClose={closeModal} title="Confirm">
      <p className="text-sm text-text py-5 text-center leading-relaxed">{data?.message}</p>
      <div className="flex justify-center gap-2">
        <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={closeModal}>Cancel</button>
        <button
          className="bg-danger text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-danger-hover transition"
          onClick={() => data?.onConfirm()}
        >
          {data?.dangerLabel ?? 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
