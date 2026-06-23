export interface Project {
  id: number;
  name: string;
  desc: string | null;
  folder_id: number | null;
  created_at: string;
}

export interface CreateProjectArgs {
  name: string;
  desc?: string | null;
  folderId?: number | null;
}

export interface UpdateProjectArgs {
  id: number;
  name: string;
  desc?: string | null;
  folderId?: number | null;
}

export interface MoveProjectArgs {
  id: number;
  newFolderId: number | null;
}
