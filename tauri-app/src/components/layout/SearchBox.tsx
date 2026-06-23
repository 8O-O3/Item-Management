import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { chatApi } from '@/api';
import type { SearchResult } from '@/types/search';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectProjectById = useAppStore((s) => s.selectProjectById);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const r = await chatApi.searchAll(q);
      setResults(r);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-48 px-3 py-1.5 rounded-lg text-[13px] bg-surface border border-border text-text placeholder-text-secondary outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent/40 transition"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-modal z-50 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.result_type}-${r.project_id}-${i}`}
              className="w-full text-left px-3 py-2 text-sm text-text hover:bg-accent/10 transition flex items-center gap-2"
              onClick={() => {
                selectProjectById(r.project_id);
                setOpen(false);
                setQuery('');
              }}
            >
              <span className="text-text-secondary text-xs uppercase w-12 shrink-0">{r.result_type}</span>
              <span className="truncate">{r.name}</span>
              <span className="text-text-secondary text-xs ml-auto shrink-0">{r.project_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
