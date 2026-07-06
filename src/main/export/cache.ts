import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { ModrinthMeta } from './types';

const CACHE_DIR = path.join(app.getPath('userData'), 'cache');
const CACHE_FILE = path.join(CACHE_DIR, '.modpack_exporter_cache.json');

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

function getCache(): ModrinthCache {
  if (!_cache) {
    _cache = new ModrinthCache(CACHE_FILE);
  }
  return _cache;
}

export { ModrinthCache, getCache };
