export interface ExportOptions {
  root: string;
  config: any;
  packName: string;
  version: string;
  isLite: boolean;
  isRelease: boolean;
  exportDir: string;
}

export interface ExportResult {
  success: boolean;
  outputPath: string | null;
  mcVersion: string;
  loaderVersion: string;
  stats: { total: number; resolved: number; embedded: number } | null;
  changes: any;
}

export interface ModEntry {
  path: string;
  downloads: string[];
  hashes: { sha1: string; sha512: string; sha256: string };
  fileSize: number;
  env: { client: string; server: string };
  filename: string;
  sha1: string;
  mod_id: string | null;
  title: string | null;
  version: string | null;
}

export interface ChangelogChanges {
  added: string[];
  removed: string[];
  updated: string[];
}

export interface ModrinthMeta {
  downloads: string[];
  sha512: string | null;
  env: { client: string; server: string };
  project_id: string | null;
  version: string;
  title: string | null;
}
