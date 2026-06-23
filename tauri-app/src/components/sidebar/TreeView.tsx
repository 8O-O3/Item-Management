import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { foldersApi, projectsApi } from '@/api';
import * as modalsApi from '@/components/modals/modalStore';
import ContextMenu, { useContextMenu, type ContextMenuItem } from './ContextMenu';
import InlineInput from './InlineInput';

// ── Module-level drag ref (WebKit blocks getData during dragover/drop) ──
interface DragPayload { type: 'folder' | 'project'; id: number; name: string }
let dragPayload: DragPayload | null = null;
let dragClearTimer: ReturnType<typeof setTimeout> | null = null;

function setDragPayload(p: DragPayload) {
  if (dragClearTimer) clearTimeout(dragClearTimer);
  dragPayload = p;
}
function clearDragPayload() {
  if (dragClearTimer) clearTimeout(dragClearTimer);
  dragClearTimer = setTimeout(() => { dragPayload = null; }, 400);
}
function takeDragPayload(): DragPayload | null {
  const p = dragPayload;
  dragPayload = null;
  if (dragClearTimer) { clearTimeout(dragClearTimer); dragClearTimer = null; }
  return p;
}

// useDragOver — counter-based drag-over state to prevent flicker from child elements
function useDragOver() {
  const [dragOver, setDragOver] = useState(false);
  const counter = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    counter.current++;
    if (counter.current === 1) setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDragLeave = useCallback(() => {
    counter.current--;
    if (counter.current <= 0) {
      counter.current = 0;
      setDragOver(false);
    }
  }, []);

  const reset = useCallback(() => {
    counter.current = 0;
    setDragOver(false);
  }, []);

  return { dragOver, onDragEnter, onDragOver, onDragLeave, reset };
}

// ── Helpers ─────────────────────────────────────────────────────
function isDescendantFolder(folderId: number, candidateParentId: number, folders: { id?: number; parent_id: number | null }[]): boolean {
  let current: number | null = candidateParentId;
  const visited = new Set<number>();
  while (current !== null) {
    if (current === folderId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    const parent = folders.find(f => f.id === current);
    current = parent?.parent_id ?? null;
  }
  return false;
}

function getFolderDepth(folderId: number, folders: { id?: number; parent_id: number | null }[]): number {
  let depth = 1;
  let current: number | null = folderId;
  const visited = new Set<number>();
  while (current !== null) {
    if (visited.has(current)) break;
    visited.add(current);
    const folder = folders.find(f => f.id === current);
    current = folder?.parent_id ?? null;
    if (current !== null) depth++;
  }
  return depth;
}

// ── Types ────────────────────────────────────────────────────────
interface InlineState {
  type: 'folder' | 'project';
  parentId: number | null;
}

// ═══════════════════════════════════════════════════════════════
// TreeView — Root component
// ═══════════════════════════════════════════════════════════════
export default function TreeView() {
  const folders = useAppStore((s) => s.folders);
  const projects = useAppStore((s) => s.projects);
  const expandedFolders = useAppStore((s) => s.expandedFolders);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const currentProject = useAppStore((s) => s.currentProject);
  const toggleFolderExpand = useAppStore((s) => s.toggleFolderExpand);
  const selectFolder = useAppStore((s) => s.selectFolder);
  const selectProject = useAppStore((s) => s.selectProject);
  const loadData = useAppStore((s) => s.loadData);

  const [inline, setInline] = useState<InlineState | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragPayload | null>(null);
  const { menu, show, close } = useContextMenu();

  const handleInlineConfirm = useCallback(async (name: string) => {
    if (!name || !inline) return;
    try {
      if (inline.type === 'folder') {
        await foldersApi.createFolder(name, inline.parentId);
      } else {
        await projectsApi.createProject(name, null, inline.parentId);
      }
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setInline(null);
  }, [inline, loadData]);

  const handleDrop = useCallback(async (targetFolderId: number | null) => {
    const data = takeDragPayload();
    setDraggedItem(null);
    if (!data) return;

    if (data.type === 'folder' && targetFolderId !== null) {
      if (data.id === targetFolderId) return;
      if (isDescendantFolder(data.id, targetFolderId, folders)) return;
      if (getFolderDepth(targetFolderId, folders) >= 4) return;
    }
    try {
      if (data.type === 'project') {
        await projectsApi.moveProject(data.id, targetFolderId);
      } else {
        await foldersApi.moveFolder(data.id, targetFolderId);
      }
      await loadData();
    } catch (err) {
      console.error('[drag] Move failed:', err);
    }
  }, [folders, loadData]);

  const isRootSelected = currentFolder === null && !currentProject;

  return (
    <div className="sidebar-section">
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-2 mb-2 select-none">Explorer</div>

      <div id="treeList">
        <RootRow
          isSelected={isRootSelected}
          onClick={() => selectFolder(null)}
          onContextMenu={(x, y) => show(getRootMenuItems(setInline), x, y)}
          menuButton={
            <TreeMenuButton onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              show(getRootMenuItems(setInline), r.left, r.bottom);
            }} />
          }
        >
          <span className="w-4 shrink-0" />
          <span className="shrink-0 select-none">🏠</span>
          <span className="truncate select-none">All</span>
        </RootRow>

        {inline?.parentId === null && (
          <InlineInput type={inline.type} onConfirm={handleInlineConfirm} onCancel={() => setInline(null)} />
        )}

        <TreeLevel
          folders={folders}
          projects={projects}
          parentId={null}
          depth={1}
          expandedFolders={expandedFolders}
          currentFolder={currentFolder}
          currentProject={currentProject}
          toggleFolderExpand={toggleFolderExpand}
          selectFolder={selectFolder}
          selectProject={selectProject}
          showMenu={show}
          inline={inline}
          setInline={setInline}
          onInlineConfirm={handleInlineConfirm}
          onDrop={handleDrop}
          draggedItem={draggedItem}
          setDraggedItem={setDraggedItem}
        />
      </div>

      <div className="flex gap-2 mt-2 px-2">
        <button className="flex-1 text-xs py-1 rounded-md bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition"
          onClick={() => modalsApi.openModal('folder')}>+ New Folder</button>
        <button className="flex-1 text-xs py-1 rounded-md bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition"
          onClick={() => modalsApi.openModal('project')}>+ New Project</button>
      </div>

      {menu && <ContextMenu items={menu.items} x={menu.x} y={menu.y} onClose={close} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RootRow
// ═══════════════════════════════════════════════════════════════
function RootRow({
  isSelected, onClick, onContextMenu, menuButton, children,
}: {
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (x: number, y: number) => void;
  menuButton?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`tree-row group flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md text-sm transition select-none ${
        isSelected ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface'
      }`}
      style={{ paddingRight: 8 }}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
    >
      {children}
      <span className="ml-auto shrink-0">{menuButton}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TreeMenuButton
// ═══════════════════════════════════════════════════════════════
function TreeMenuButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="btn-icon-menu opacity-0 group-hover:opacity-100 hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-text-secondary hover:text-accent hover:bg-surface transition text-sm font-bold select-none"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title="More actions"
    >…</button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TreeLevel — recursive folder/project listing
// ═══════════════════════════════════════════════════════════════
interface TreeLevelProps {
  folders: ReturnType<typeof useAppStore.getState>['folders'];
  projects: ReturnType<typeof useAppStore.getState>['projects'];
  parentId: number | null;
  depth: number;
  expandedFolders: Set<number>;
  currentFolder: number | null;
  currentProject: ReturnType<typeof useAppStore.getState>['currentProject'];
  toggleFolderExpand: (id: number) => void;
  selectFolder: (id: number | null) => void;
  selectProject: (p: ReturnType<typeof useAppStore.getState>['projects'][0]) => void;
  showMenu: ReturnType<typeof useContextMenu>['show'];
  inline: InlineState | null;
  setInline: (s: InlineState | null) => void;
  onInlineConfirm: (name: string) => void;
  onDrop: (targetFolderId: number | null) => void;
  draggedItem: DragPayload | null;
  setDraggedItem: (p: DragPayload | null) => void;
}

function TreeLevel({
  folders, projects, parentId, depth,
  expandedFolders, currentFolder, currentProject,
  toggleFolderExpand, selectFolder, selectProject,
  showMenu, inline, setInline, onInlineConfirm, onDrop,
  draggedItem, setDraggedItem,
}: TreeLevelProps) {
  const childFolders = folders.filter((f) => f.parent_id === parentId);
  const childProjects = projects.filter((p) => p.folder_id === parentId);
  const canDropFolder = parentId === null || depth <= 4;

  const items = [
    ...childFolders.map((f) => ({ type: 'folder' as const, data: f })),
    ...childProjects.map((p) => ({ type: 'project' as const, data: p })),
  ].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.data.name.localeCompare(b.data.name);
  });

  const isEmpty = items.length === 0 && !(inline && inline.parentId === parentId);

  return (
    <div className="rounded-md transition-colors">
      {inline?.parentId === parentId && (
        <div style={{ paddingLeft: depth * 16 }}>
          <InlineInput type={inline.type} onConfirm={onInlineConfirm} onCancel={() => setInline(null)} />
        </div>
      )}

      {isEmpty && parentId !== null && draggedItem && (draggedItem.type === 'project' || canDropFolder) && (
        <DropHint
          parentId={parentId}
          canDropFolder={canDropFolder}
          onDrop={onDrop}
        />
      )}

      {items.map((item) =>
        item.type === 'folder' ? (
          <TreeFolderRow
            key={`f-${item.data.id}`}
            folder={item.data}
            depth={depth}
            isExpanded={expandedFolders.has(item.data.id!)}
            isSelected={currentFolder === item.data.id && !currentProject}
            isDraggedItem={draggedItem?.type === 'folder' && draggedItem.id === item.data.id}
            hasChildren={
              folders.some((c) => c.parent_id === item.data.id) ||
              projects.some((p) => p.folder_id === item.data.id)
            }
            onToggle={() => toggleFolderExpand(item.data.id!)}
            onSelect={() => selectFolder(item.data.id!)}
            onContextMenu={(x, y) => showMenu(getFolderMenuItems(item.data.id!, depth, setInline), x, y)}
            onDrop={() => onDrop(item.data.id!)}
            onDragStart={() => {
              setDragPayload({ type: 'folder', id: item.data.id!, name: item.data.name });
              setDraggedItem({ type: 'folder', id: item.data.id!, name: item.data.name });
            }}
            onDragEnd={() => { clearDragPayload(); setDraggedItem(null); }}
          >
            {(expandedFolders.has(item.data.id!) || (inline && inline.parentId === item.data.id)) && (
              <TreeLevel
                folders={folders} projects={projects}
                parentId={item.data.id!} depth={depth + 1}
                expandedFolders={expandedFolders}
                currentFolder={currentFolder} currentProject={currentProject}
                toggleFolderExpand={toggleFolderExpand}
                selectFolder={selectFolder} selectProject={selectProject}
                showMenu={showMenu} inline={inline} setInline={setInline}
                onInlineConfirm={onInlineConfirm} onDrop={onDrop}
                draggedItem={draggedItem} setDraggedItem={setDraggedItem}
              />
            )}
          </TreeFolderRow>
        ) : (
          <TreeProjectRow
            key={`p-${item.data.id}`}
            project={item.data}
            depth={depth}
            isSelected={currentProject?.id === item.data.id}
            isDraggedItem={draggedItem?.type === 'project' && draggedItem.id === item.data.id}
            onSelect={() => selectProject(item.data)}
            onContextMenu={(x, y) => showMenu(getProjectMenuItems(item.data.id!, setInline), x, y)}
            onDragStart={() => {
              setDragPayload({ type: 'project', id: item.data.id!, name: item.data.name });
              setDraggedItem({ type: 'project', id: item.data.id!, name: item.data.name });
            }}
            onDragEnd={() => { clearDragPayload(); setDraggedItem(null); }}
          />
        ),
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DropHint — empty folder drop zone
// ═══════════════════════════════════════════════════════════════
function DropHint({
  parentId, canDropFolder, onDrop,
}: {
  parentId: number;
  canDropFolder: boolean;
  onDrop: (targetFolderId: number | null) => void;
}) {
  const { dragOver, onDragEnter, onDragOver: onDragOverCb, onDragLeave, reset: resetDragOver } = useDragOver();

  return (
    <div
      className={`mx-2 my-1 rounded-md border-2 border-dashed text-[11px] text-center py-3 transition-colors select-none ${
        dragOver ? 'bg-accent/10 border-accent/50 text-accent' : 'border-accent/30 text-text-secondary'
      }`}
      onDragEnter={(e) => {
        if (dragPayload?.type === 'folder' && !canDropFolder) return;
        onDragEnter(e);
      }}
      onDragOver={(e) => {
        if (dragPayload?.type === 'folder' && !canDropFolder) return;
        onDragOverCb(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        if (dragPayload?.type === 'folder' && !canDropFolder) return;
        e.preventDefault();
        resetDragOver();
        onDrop(parentId);
      }}
    >
      Drop here to move into this folder
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TreeFolderRow
//
// Sibling separation to work around WKWebView bug:
// The drag handle (icon) is a DOM sibling of the drop target (content div).
// This ensures dragover/drop events reach the drop target even though
// a draggable element exists at the same level.
//
// Layout:
// ┌── outer flex row ──────────────────────────────────────────┐
// │ [📁]  │  ▸  Folder Name                               … │
// │ drag  │  drop target (NOT draggable, no draggable children)│
// │ handle│                                                   │
// └────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════
function TreeFolderRow({
  folder, depth, isExpanded, isSelected, hasChildren, isDraggedItem,
  onToggle, onSelect, onContextMenu, onDrop, onDragStart, onDragEnd, children,
}: {
  folder: ReturnType<typeof useAppStore.getState>['folders'][0];
  depth: number; isExpanded: boolean; isSelected: boolean; hasChildren: boolean; isDraggedItem: boolean;
  onToggle: () => void; onSelect: () => void;
  onContextMenu: (x: number, y: number) => void;
  onDrop: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  children?: React.ReactNode;
}) {
  const { dragOver, onDragEnter, onDragOver: onDragOverCb, onDragLeave, reset: resetDragOver } = useDragOver();

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1 rounded-md text-sm transition select-none ${
          isSelected ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface'
        } ${dragOver ? 'bg-accent/15 ring-2 ring-accent/40 scale-[1.02]' : ''} ${
          isDraggedItem ? 'opacity-40' : ''
        }`}
        style={{ paddingLeft: depth * 16 + 8, paddingRight: 8 }}
        onClick={onSelect}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
      >
        {/* Drag handle — draggable icon, sibling of drop target */}
        <span
          className="shrink-0 cursor-grab select-none"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', folder.id!.toString());
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >📁</span>

        {/* Drop target — NOT draggable, handles all drag events.
            Being a sibling (not parent) of the draggable icon avoids the WKWebView bug. */}
        <div
          className="flex-1 flex items-center gap-2 min-w-0"
          onDragEnter={(e) => {
            if (dragPayload?.type === 'folder' && depth >= 4) return;
            onDragEnter(e);
          }}
          onDragOver={(e) => {
            if (dragPayload?.type === 'folder' && depth >= 4) return;
            onDragOverCb(e);
          }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            resetDragOver();
            onDrop();
          }}
        >
          {/* Chevron */}
          <span
            className="w-4 shrink-0 text-center text-xs text-text-secondary"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ' '}
          </span>

          {/* Name */}
          <span className="truncate select-none">{folder.name}</span>

          {/* Menu button */}
          <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
            <TreeMenuButton onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onContextMenu(r.left, r.bottom);
            }} />
          </span>
        </div>
      </div>
      {children}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TreeProjectRow — drag handle is a sibling of the content area.
// Projects are NOT drop targets (they are leaf nodes).
// ═══════════════════════════════════════════════════════════════
function TreeProjectRow({
  project, depth, isSelected, isDraggedItem,
  onSelect, onContextMenu, onDragStart, onDragEnd,
}: {
  project: ReturnType<typeof useAppStore.getState>['projects'][0];
  depth: number; isSelected: boolean; isDraggedItem: boolean;
  onSelect: () => void; onContextMenu: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-1 rounded-md text-sm transition select-none ${
        isSelected ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface'
      } ${isDraggedItem ? 'opacity-40' : ''}`}
      style={{ paddingLeft: depth * 16 + 8, paddingRight: 8 }}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
    >
      {/* Drag handle — draggable icon, sibling of content */}
      <span
        className="shrink-0 cursor-grab select-none"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', project.id!.toString());
          e.dataTransfer.effectAllowed = 'move';
          e.stopPropagation();
          onDragStart();
        }}
        onDragEnd={onDragEnd}
      >📄</span>

      {/* Content area — NOT draggable */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="w-4 shrink-0" />
        <span className="truncate select-none">{project.name}</span>
        <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
          <TreeMenuButton onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onContextMenu(r.left, r.bottom);
          }} />
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Menu generators
// ═══════════════════════════════════════════════════════════════
function getRootMenuItems(setInline: (s: InlineState) => void): ContextMenuItem[] {
  return [
    { label: 'New Folder', action: () => setInline({ type: 'folder', parentId: null }) },
    { label: 'New Project', action: () => setInline({ type: 'project', parentId: null }) },
  ];
}

function getFolderMenuItems(id: number, depth: number, setInline: (s: InlineState) => void): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  if (depth < 4) {
    items.push({ label: 'New Sub-folder', action: () => { useAppStore.getState().toggleFolderExpand(id); setInline({ type: 'folder', parentId: id }); } });
  }
  items.push({ label: 'New Project Here', action: () => { useAppStore.getState().toggleFolderExpand(id); setInline({ type: 'project', parentId: id }); } });
  items.push({ separator: true, label: '', action: () => {} });
  items.push({ label: 'Rename', action: () => modalsApi.openModal('folder', id) });
  items.push({ label: 'Delete', danger: true, action: () => modalsApi.confirmDelete('folder', id) });
  return items;
}

function getProjectMenuItems(id: number, setInline: (s: InlineState) => void): ContextMenuItem[] {
  return [
    { label: 'Rename', action: () => modalsApi.openModal('project', id) },
    { label: 'Delete', danger: true, action: () => modalsApi.confirmDelete('project', id) },
  ];
}
