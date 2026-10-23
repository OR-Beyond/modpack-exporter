import path from 'path';
import fs from 'fs';

export const HASH_CACHE_SCHEMA_VERSION = 3;

export interface HashCacheEntry {
  sha1: string;
  sha512: string;
  size: number;
  url: string | null;
  files?: Array<{ url: string; filename: string; size: number; hashes: { sha1: string; sha512: string } }>;
  expiresAt?: number;
}

export class HashCache {
  private filePath: string;
  private schemaVersion: number;
  private entries: Record<string, HashCacheEntry | null>;
  private dirty = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.schemaVersion = HASH_CACHE_SCHEMA_VERSION;
    this.entries = {};
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (raw && raw.schemaVersion === HASH_CACHE_SCHEMA_VERSION && raw.entries && typeof raw.entries === 'object') {
        this.entries = raw.entries;
      }
      // else: ignore stale/partial entries (schema mismatch)
    } catch {
      this.entries = {};
    }
  }

  get(key: string): HashCacheEntry | null | undefined {
    if (!(key in this.entries)) return undefined;
    const v = this.entries[key];
    if (v === null) return undefined; // never treat a persisted miss as permanent
    if (v && typeof v.expiresAt === 'number' && v.expiresAt > 0 && Date.now() > v.expiresAt) {
      delete this.entries[key];
      this.dirty = true;
      return undefined;
    }
    return v;
  }

  set(key: string, value: HashCacheEntry | null): void {
    this.entries[key] = value;
    this.dirty = true;
  }

  save(): void {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify({ schemaVersion: this.schemaVersion, entries: this.entries }, null, 2), 'utf-8');
      this.dirty = false;
    } catch {
      // best-effort
    }
  }

  getSchemaVersion(): number {
    return this.schemaVersion;
  }
}
