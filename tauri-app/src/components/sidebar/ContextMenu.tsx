import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void;
}

interface Props {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ items, x, y, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
    if (left < 0) left = 8;
    if (top < 0) top = 8;
    setPos({ x: left, y: top });
  }, [x, y]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10000] bg-surface border border-border rounded-xl shadow-modal py-1 min-w-[150px]"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="border-t border-border my-1" />
        ) : (
          <button
            key={i}
            className={`w-full text-left px-3 py-1.5 text-sm transition ${
              item.danger
                ? 'text-danger hover:bg-danger/10'
                : 'text-text hover:bg-surface'
            }`}
            role="menuitem"
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function useContextMenu() {
  const [menu, setMenu] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
  const show = useCallback((items: ContextMenuItem[], x: number, y: number) => setMenu({ items, x, y }), []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, show, close };
}
