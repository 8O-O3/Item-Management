export interface NodeFile {
  name: string;
  path: string;
  size: number | null;
  data: string | null;
  added_at: string;
}

export interface TimelineEntry {
  content: string;
  time: string;
}

export interface Node {
  id: number;
  project_id: number;
  title: string;
  desc: string | null;
  files: NodeFile[];
  timeline: TimelineEntry[];
  created_at: string;
}

export interface CreateNodeArgs {
  projectId: number;
  title: string;
  desc?: string | null;
}

export interface UpdateNodeArgs {
  id: number;
  title: string;
  desc?: string | null;
}

export interface AddFileToNodeArgs {
  nodeId: number;
  name: string;
  path: string;
  size?: number | null;
  data?: string | null;
}

export interface RemoveFileFromNodeArgs {
  nodeId: number;
  fileIdx: number;
}

export interface AddTimelineEntryArgs {
  nodeId: number;
  content: string;
}
