import { useRef, useEffect } from 'react';

interface Props {
  type: 'folder' | 'project';
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function InlineInput({ type, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const label = type === 'folder' ? 'Folder name' : 'Project name';

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 py-1 pl-4 pr-2">
      <span className="shrink-0 text-sm">{type === 'folder' ? '📁' : '📄'}</span>
      <input
        ref={ref}
        type="text"
        className="flex-1 min-w-0 px-2 py-1 rounded text-sm bg-bg border border-accent text-text outline-none"
        placeholder={label}
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm((e.target as HTMLInputElement).value.trim());
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => setTimeout(onCancel, 150)}
      />
    </div>
  );
}
