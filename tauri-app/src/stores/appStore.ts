import { create } from 'zustand';
import type { Folder, Project } from '@/types';
import type { Node } from '@/types/node';
import * as foldersApi from '@/api/folders';
import * as projectsApi from '@/api/projects';
import * as nodesApi from '@/api/nodes';

interface AppState {
  folders: Folder[];
  projects: Project[];
  currentFolder: number | null;
  currentProject: Project | null;
  currentNodes: Node[];
  expandedNodes: Set<number>;
  expandedFolders: Set<number>;
  sidebarMode: 'tree' | 'settings';
  isLoading: boolean;
  error: string | null;

  // Actions
  loadData: () => Promise<void>;
  selectFolder: (id: number | null) => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  selectProjectById: (id: number) => Promise<void>;
  toggleFolderExpand: (id: number) => void;
  toggleNodeExpand: (id: number) => void;
  setSidebarMode: (mode: 'tree' | 'settings') => void;
  refreshProjects: () => Promise<void>;
  refreshNodes: () => Promise<void>;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  folders: [],
  projects: [],
  currentFolder: null,
  currentProject: null,
  currentNodes: [],
  expandedNodes: new Set<number>(),
  expandedFolders: new Set<number>(),
  sidebarMode: 'tree',
  isLoading: false,
  error: null,

  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [folders, projects] = await Promise.all([
        foldersApi.getFolders(),
        projectsApi.getProjects(),
      ]);
      set({ folders, projects, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  selectFolder: async (id) => {
    if (id !== null) {
      const { folders } = get();
      const expanded = new Set(get().expandedFolders);
      let current: number | null = id;
      while (current) {
        const f = folders.find((x) => x.id === current);
        if (f?.parent_id) {
          expanded.add(f.parent_id);
          current = f.parent_id;
        } else {
          break;
        }
      }
      set({ expandedFolders: expanded });
    }
    set({ currentFolder: id, currentProject: null, currentNodes: [] });
  },

  selectProject: async (project) => {
    set({ currentFolder: project.folder_id, currentProject: project, currentNodes: [], expandedNodes: new Set() });
    if (project.id) {
      try {
        const nodes = await nodesApi.getNodes(project.id);
        set({ currentNodes: nodes });
      } catch (e) {
        set({ error: 'Failed to load nodes: ' + String(e), currentNodes: [] });
      }
    }
  },

  selectProjectById: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (project) {
      await get().selectProject(project);
    }
  },

  toggleFolderExpand: (id) => {
    const expanded = new Set(get().expandedFolders);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    set({ expandedFolders: expanded });
  },

  toggleNodeExpand: (id) => {
    const expanded = new Set(get().expandedNodes);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    set({ expandedNodes: expanded });
  },

  setSidebarMode: (mode) => set({ sidebarMode: mode }),

  refreshProjects: async () => {
    try {
      const projects = await projectsApi.getProjects();
      set({ projects });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshNodes: async () => {
    const cp = get().currentProject;
    if (!cp?.id) return;
    try {
      const nodes = await nodesApi.getNodes(cp.id);
      set({ currentNodes: nodes });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearError: () => set({ error: null }),
}));
