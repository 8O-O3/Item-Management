import { invoke } from './core';
import type { Project, CreateProjectArgs, UpdateProjectArgs, MoveProjectArgs } from '@/types/project';

export async function getProjects(): Promise<Project[]> {
  return invoke<Project[]>('get_projects');
}

export async function createProject(name: string, desc?: string | null, folderId?: number | null): Promise<Project> {
  return invoke<Project>('create_project', { name, desc, folderId } satisfies CreateProjectArgs);
}

export async function updateProject(id: number, name: string, desc?: string | null, folderId?: number | null): Promise<void> {
  return invoke<void>('update_project', { id, name, desc, folderId } satisfies UpdateProjectArgs);
}

export async function moveProject(id: number, newFolderId: number | null): Promise<void> {
  return invoke<void>('move_project', { id, newFolderId } satisfies MoveProjectArgs);
}

export async function deleteProject(id: number): Promise<void> {
  return invoke<void>('delete_project', { id });
}
