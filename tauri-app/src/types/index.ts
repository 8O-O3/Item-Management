export type { Folder } from './folder';
export type { Project } from './project';

export interface ImportData {
  folders: import('./folder').Folder[];
  projects: import('./project').Project[];
  nodes: import('./node').Node[];
}

export interface AiChunk {
  content: string;
}

export interface AiDone {
  error: string | null;
}
