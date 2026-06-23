import { useEffect, useCallback } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: Props) {
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass rounded-card shadow-modal ${wide ? 'w-[580px]' : 'w-[440px]'} max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="text-base font-semibold text-text px-6 pt-5 pb-3">{title}</div>
        <div className="px-6 pb-5 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
