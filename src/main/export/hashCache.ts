import path from 'path';
import fs from 'fs';

export const HASH_CACHE_SCHEMA_VERSION = 2;

export interface HashCacheEntry {
  sha1: string;
  sha512: string;
  size: number;
  url: string | null;
}

export class HashCache {
  private filePath: string;
  private schemaVersion: number;
  private entries: Record<string, HashCacheEntry | null>;

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
    return this.entries[key];
  }

  set(key: string, value: HashCacheEntry | null): void {
    this.entries[key] = value;
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify({ schemaVersion: this.schemaVersion, entries: this.entries }, null, 2), 'utf-8');
    } catch {
      // best-effort
    }
  }

  getSchemaVersion(): number {
    return this.schemaVersion;
  }
}
