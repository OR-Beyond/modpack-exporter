import { isLowerHex } from './hash';
import { MrpackError } from './errors';

export interface ManifestFileEntry {
  path: string;
  hashes: { sha1: string; sha512: string };
  downloads: string[];
  fileSize: number;
  env?: { client: string; server: string };
  // optional extra fields preserved for compatibility
  [key: string]: unknown;
}

export function normalizeEntryPath(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new MrpackError({ code: 'UNSAFE_PATH', detail: 'path must be a non-empty string' });
  }
  // Convert backslashes to forward slashes
  let p = input.replace(/\\/g, '/');
  // Strip leading separators
  p = p.replace(/^\/+/, '');
  // Reject drive prefix
  if (/^[a-zA-Z]:/.test(p)) {
    throw new MrpackError({ code: 'UNSAFE_PATH', detail: `path has drive prefix: ${input}`, file: input });
  }
  const segments = p.split('/');
  if (segments.some(s => s === '..')) {
    throw new MrpackError({ code: 'UNSAFE_PATH', detail: `path contains traversal: ${input}`, file: input });
  }
  if (segments.some(s => s === '')) {
    // collapse? reject empty segments to be safe
    // allow but normalize by filtering empties
    p = segments.filter(s => s !== '').join('/');
  }
  if (p.length === 0) {
    throw new MrpackError({ code: 'UNSAFE_PATH', detail: 'path empty after normalization', file: input });
  }
  return p;
}

export interface CreateEntryInput {
  path: string;
  sha1: string;
  sha512: string;
  downloads?: string[];
  fileSize: number;
  env?: { client: string; server: string };
  [key: string]: unknown;
}

export function createManifestFileEntry(input: CreateEntryInput): ManifestFileEntry {
  const pathNorm = normalizeEntryPath(input.path);
  if (!isLowerHex(input.sha1, 40)) {
    throw new MrpackError({ code: 'MISSING_FILE_HASH', detail: `invalid sha1 for ${pathNorm}`, file: pathNorm });
  }
  if (!isLowerHex(input.sha512, 128)) {
    throw new MrpackError({ code: 'MISSING_FILE_HASH', detail: `invalid sha512 for ${pathNorm}`, file: pathNorm });
  }
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize < 0) {
    throw new MrpackError({ code: 'INVALID_FILE_SIZE', detail: `invalid fileSize for ${pathNorm}`, file: pathNorm });
  }
  const downloads = Array.isArray(input.downloads) ? [...input.downloads] : [];
  const entry: ManifestFileEntry = {
    path: pathNorm,
    hashes: { sha1: input.sha1, sha512: input.sha512 },
    downloads,
    fileSize: input.fileSize,
  };
  if (input.env) entry.env = input.env;
  // copy extras
  for (const k of Object.keys(input)) {
    if (k === 'path' || k === 'sha1' || k === 'sha512' || k === 'downloads' || k === 'fileSize' || k === 'env') continue;
    (entry as any)[k] = (input as any)[k];
  }
  return entry;
}
