export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

export interface CreateFolderArgs {
  name: string;
  parentId?: number | null;
}

export interface UpdateFolderArgs {
  id: number;
  name: string;
}

export interface MoveFolderArgs {
  id: number;
  newParentId: number | null;
}
