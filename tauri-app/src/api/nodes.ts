import { invoke } from './core';
import type { Node, CreateNodeArgs, UpdateNodeArgs, AddFileToNodeArgs, RemoveFileFromNodeArgs, AddTimelineEntryArgs } from '@/types/node';

export async function getNodes(projectId: number): Promise<Node[]> {
  return invoke<Node[]>('get_nodes', { projectId });
}

export async function createNode(projectId: number, title: string, desc?: string | null): Promise<Node> {
  return invoke<Node>('create_node', { projectId, title, desc: desc ?? null } satisfies CreateNodeArgs);
}

export async function updateNode(id: number, title: string, desc?: string | null): Promise<void> {
  return invoke<void>('update_node', { id, title, desc: desc ?? null } satisfies UpdateNodeArgs);
}

export async function deleteNode(id: number): Promise<void> {
  return invoke<void>('delete_node', { id });
}

export async function addFileToNode(nodeId: number, name: string, path: string, size?: number | null, data?: string | null): Promise<void> {
  return invoke<void>('add_file_to_node', { nodeId, name, path, size, data } satisfies AddFileToNodeArgs);
}

export async function removeFileFromNode(nodeId: number, fileIdx: number): Promise<void> {
  return invoke<void>('remove_file_from_node', { nodeId, fileIdx } satisfies RemoveFileFromNodeArgs);
}

export async function readFileBytes(nodeId: number, fileIdx: number): Promise<number[]> {
  return invoke<number[]>('read_file_bytes', { nodeId, fileIdx });
}

export async function saveNodeFile(data: string, path: string): Promise<void> {
  return invoke<void>('save_node_file', { data, path });
}

export async function addTimelineEntry(nodeId: number, content: string): Promise<void> {
  return invoke<void>('add_timeline_entry', { nodeId, content } satisfies AddTimelineEntryArgs);
}

export async function updateTimelineEntry(nodeId: number, entryIdx: number, content: string): Promise<void> {
  return invoke<void>('update_timeline_entry', { nodeId, entryIdx, content });
}

export async function deleteTimelineEntry(nodeId: number, entryIdx: number): Promise<void> {
  return invoke<void>('delete_timeline_entry', { nodeId, entryIdx });
}
