import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { ModrinthMeta } from './types';

class ModrinthCache {
  private path: string;
  private data: Record<string, ModrinthMeta>;

  constructor(filePath: string) {
    this.path = filePath;
    this.data = {};
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }
  }

  save(): void {
    fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  get(sha1: string): ModrinthMeta | undefined {
    return this.data[sha1];
  }

  set(sha1: string, entry: ModrinthMeta): void {
    this.data[sha1] = entry;
    this.save();
  }
}

let _cache: ModrinthCache | null = null;

function defaultCacheFile(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'cache', '.modpack_exporter_cache.json');
    }
  } catch {}
  return path.join(process.cwd(), '.cache', '.modpack_exporter_cache.json');
}

function getCache(): ModrinthCache {
  if (!_cache) {
    _cache = new ModrinthCache(defaultCacheFile());
  }
  return _cache;
}

export { ModrinthCache, getCache };
