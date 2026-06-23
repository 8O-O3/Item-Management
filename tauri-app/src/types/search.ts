export interface SearchResult {
  result_type: 'node' | 'project';
  name: string;
  project_id: number;
  project_name: string;
}
