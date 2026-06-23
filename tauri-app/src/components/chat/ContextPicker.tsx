import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useChatStore } from '@/stores/chatStore';
import { nodesApi } from '@/api';
import type { ChatContextSelections } from '@/types/chat';
import type { Folder, Project } from '@/types';

interface Props {
  children: React.ReactNode;
}

export default function ContextPicker({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [nodeCache, setNodeCache] = useState<Record<number, Array<{ id: number | undefined; title: string; fileCount: number }>>>({});
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const folders = useAppStore((s) => s.folders);
  const projects = useAppStore((s) => s.projects);
  const contextSelections = useChatStore((s) => s.contextSelections);
  const setContextSelections = useChatStore((s) => s.setContextSelections);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    const cache: typeof nodeCache = {};
    await Promise.all(projects.map(async (p) => {
      if (!p.id) return;
      try {
        const nodes = await nodesApi.getNodes(p.id);
        cache[p.id] = nodes.map((n) => ({ id: n.id, title: n.title, fileCount: n.files?.length ?? 0 }));
      } catch { cache[p.id] = []; }
    }));
    setNodeCache(cache);
    setLoading(false);
  }, [projects]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', onClick);
      if (Object.keys(nodeCache).length === 0) loadNodes();
    }
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen, loadNodes, nodeCache]);

  // ── Helpers ──────────────────────────────────────────────
  const getDescendantFolderIds = (folderId: number, allFolders: Folder[]): number[] => {
    const ids: number[] = [folderId];
    for (const f of allFolders) {
      if (f.parent_id === folderId && f.id != null) {
        ids.push(...getDescendantFolderIds(f.id, allFolders));
      }
    }
    return ids;
  };

  const getDescendantProjectIds = (folderId: number, allFolders: Folder[], allProjects: Project[]): number[] => {
    const ids: number[] = [];
    for (const p of allProjects) {
      if (p.folder_id === folderId && p.id != null) ids.push(p.id);
    }
    for (const f of allFolders) {
      if (f.parent_id === folderId && f.id != null) {
        ids.push(...getDescendantProjectIds(f.id, allFolders, allProjects));
      }
    }
    return ids;
  };

  const toggleFolder = (fid: number) => {
    const sel: ChatContextSelections = {
      folderIds: [...contextSelections.folderIds],
      projectIds: [...contextSelections.projectIds],
      nodeIds: [...contextSelections.nodeIds],
    };

    if (sel.folderIds.includes(fid)) {
      // Uncheck: remove folder and all descendants
      const allFolderIds = getDescendantFolderIds(fid, folders);
      sel.folderIds = sel.folderIds.filter((id) => !allFolderIds.includes(id));
      const projSet = new Set<number>();
      for (const fid2 of allFolderIds) {
        for (const pid of getDescendantProjectIds(fid2, folders, projects)) projSet.add(pid);
      }
      sel.projectIds = sel.projectIds.filter((id) => !projSet.has(id));
      const nodeSet = new Set<number>();
      for (const pid of projSet) {
        for (const n of (nodeCache[pid] || [])) { if (n.id != null) nodeSet.add(n.id); }
      }
      sel.nodeIds = sel.nodeIds.filter((id) => !nodeSet.has(id));
    } else {
      // Check: add folder and all descendants
      const allFolderIds = getDescendantFolderIds(fid, folders);
      sel.folderIds = [...new Set([...sel.folderIds, ...allFolderIds])];
      for (const fid2 of allFolderIds) {
        const pidToAdd = getDescendantProjectIds(fid2, folders, projects);
        for (const pid of pidToAdd) {
          if (!sel.projectIds.includes(pid)) sel.projectIds.push(pid);
          // Auto-add all nodes in this project
          for (const n of (nodeCache[pid] || [])) {
            if (n.id != null && !sel.nodeIds.includes(n.id)) sel.nodeIds.push(n.id);
          }
        }
      }
    }
    setContextSelections(sel);
  };

  const toggleProject = (pid: number) => {
    const sel: ChatContextSelections = {
      folderIds: [...contextSelections.folderIds],
      projectIds: [...contextSelections.projectIds],
      nodeIds: [...contextSelections.nodeIds],
    };
    if (sel.projectIds.includes(pid)) {
      sel.projectIds = sel.projectIds.filter((id) => id !== pid);
      // Remove all nodes of this project
      sel.nodeIds = sel.nodeIds.filter((id) => !(nodeCache[pid] || []).some((n) => n.id === id));
    } else {
      sel.projectIds.push(pid);
      // Auto-add all nodes in this project
      for (const n of (nodeCache[pid] || [])) {
        if (n.id != null && !sel.nodeIds.includes(n.id)) sel.nodeIds.push(n.id);
      }
    }
    setContextSelections(sel);
  };

  const toggleNode = (nid: number) => {
    const sel: ChatContextSelections = {
      folderIds: [...contextSelections.folderIds],
      projectIds: [...contextSelections.projectIds],
      nodeIds: [...contextSelections.nodeIds],
    };
    if (sel.nodeIds.includes(nid)) {
      sel.nodeIds = sel.nodeIds.filter((id) => id !== nid);
    } else {
      sel.nodeIds.push(nid);
    }
    setContextSelections(sel);
  };

  return (
    <div ref={pickerRef} className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>{children}</div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-modal p-2 z-50">
          {loading ? (
            <div className="text-xs text-text-secondary text-center py-4">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-xs text-text-secondary text-center py-4">No projects yet</div>
          ) : (
            <>
              {folders.filter((f) => !f.parent_id).map((f) => (
                <ContextFolder key={`f-${f.id}`} folder={f} folders={folders} projects={projects}
                  selections={contextSelections} nodeCache={nodeCache}
                  onToggleFolder={toggleFolder} onToggleProject={toggleProject} onToggleNode={toggleNode} />
              ))}
              {projects.filter((p) => !p.folder_id).map((p) => (
                <ContextProject key={`p-${p.id}`} project={p} selections={contextSelections}
                  nodes={nodeCache[p.id!] || []}
                  onToggleProject={toggleProject} onToggleNode={toggleNode} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ContextFolder({
  folder, folders, projects, selections, nodeCache,
  onToggleFolder, onToggleProject, onToggleNode,
}: {
  folder: Folder;
  folders: Folder[];
  projects: Project[];
  selections: ChatContextSelections;
  nodeCache: Record<number, Array<{ id: number | undefined; title: string; fileCount: number }>>;
  onToggleFolder: (id: number) => void;
  onToggleProject: (id: number) => void;
  onToggleNode: (id: number) => void;
}) {
  const isChecked = folder.id != null && selections.folderIds.includes(folder.id);
  const childFolders = folders.filter((f) => f.parent_id === folder.id);
  const childProjects = projects.filter((p) => p.folder_id === folder.id);

  return (
    <div>
      <label className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs cursor-pointer hover:bg-bg rounded transition font-semibold">
        <input type="checkbox" checked={isChecked}
          onChange={() => folder.id != null && onToggleFolder(folder.id)} className="rounded" />
        <span>📁 {folder.name}</span>
      </label>
      {(childFolders.length > 0 || childProjects.length > 0) && (
        <div className="pl-3">
          {childFolders.map((cf) => (
            <ContextFolder key={`cf-${cf.id}`} folder={cf} folders={folders} projects={projects}
              selections={selections} nodeCache={nodeCache}
              onToggleFolder={onToggleFolder} onToggleProject={onToggleProject} onToggleNode={onToggleNode} />
          ))}
          {childProjects.map((p) => (
            <ContextProject key={`cp-${p.id}`} project={p} selections={selections}
              nodes={nodeCache[p.id!] || []}
              onToggleProject={onToggleProject} onToggleNode={onToggleNode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextProject({
  project, selections, nodes,
  onToggleProject, onToggleNode,
}: {
  project: Project;
  selections: ChatContextSelections;
  nodes: Array<{ id: number | undefined; title: string; fileCount: number }>;
  onToggleProject: (id: number) => void;
  onToggleNode: (id: number) => void;
}) {
  const isChecked = project.id != null && selections.projectIds.includes(project.id);

  return (
    <div>
      <label className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs cursor-pointer hover:bg-bg rounded transition">
        <input type="checkbox" checked={isChecked}
          onChange={() => project.id != null && onToggleProject(project.id)} className="rounded" />
        <span>📄 {project.name}</span>
      </label>
      {nodes.length > 0 && (
        <div className="pl-5">
          {nodes.map((n) => (
            <label key={n.id} className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs cursor-pointer hover:bg-bg rounded transition">
              <input type="checkbox"
                checked={n.id != null && selections.nodeIds.includes(n.id)}
                onChange={() => n.id != null && onToggleNode(n.id)}
                className="rounded" />
              <span className="truncate">📋 {n.title}</span>
              {n.fileCount > 0 && <span className="text-text-secondary ml-auto text-[10px]">{n.fileCount}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
