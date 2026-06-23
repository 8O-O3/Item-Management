import { invoke } from './core';
import type { Folder, CreateFolderArgs, UpdateFolderArgs, MoveFolderArgs } from '@/types/folder';

export async function getFolders(): Promise<Folder[]> {
  return invoke<Folder[]>('get_folders');
}

export async function createFolder(name: string, parentId?: number | null): Promise<Folder> {
  return invoke<Folder>('create_folder', { name, parentId } satisfies CreateFolderArgs);
}

export async function updateFolder(id: number, name: string): Promise<void> {
  return invoke<void>('update_folder', { id, name } satisfies UpdateFolderArgs);
}

export async function moveFolder(id: number, newParentId: number | null): Promise<void> {
  return invoke<void>('move_folder', { id, newParentId } satisfies MoveFolderArgs);
}

export async function deleteFolder(id: number): Promise<void> {
  return invoke<void>('delete_folder', { id });
}
