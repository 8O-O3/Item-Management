import { invoke } from './core';
import type { ImportData } from '@/types';

export async function exportData(): Promise<string> {
  return invoke<string>('export_data');
}

export async function importData(jsonData: string): Promise<void> {
  return invoke<void>('import_data', { jsonData });
}

export async function saveExport(path: string): Promise<void> {
  return invoke<void>('save_export', { path });
}

export async function openAppDir(): Promise<void> {
  return invoke<void>('open_app_dir');
}

export async function getVersion(): Promise<string> {
  return invoke<string>('get_version');
}

export async function extractDocxText(data: string): Promise<string> {
  return invoke<string>('extract_docx_text', { data });
}
