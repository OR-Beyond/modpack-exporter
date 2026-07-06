import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { ModEntry, ModrinthMeta } from './types';
import { getCache } from './cache';

const MODRINTH_BASE = 'https://api.modrinth.com/v2';
const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader';
const FALLBACK_LOADER = '0.18.3';
const MAX_WORKERS = 10;
const UA_HEADERS = { 'User-Agent': 'ORB-Modpack-Exporter/1.0' };

export function computeSha1(filePath: string): string {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

export function computeSha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function computeSha512(filePath: string): string {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('hex');
}

export function getModId(jarPath: string): string | null {
  try {
    const zip = new AdmZip(jarPath);
    const entry = zip.getEntry('fabric.mod.json');
    if (entry) {
      const data = JSON.parse(entry.getData().toString('utf-8'));
      return data.id ?? null;
    }
  } catch {}
  return null;
}

export function detectVersions(
  root: string,
  fallbackMc: string,
  configLoaderVersion?: string,
): { mc: string; loader: string } {
  let mc = fallbackMc;
  let loader: string | null = configLoaderVersion ?? null;

  const mmcPath = path.join(root, 'mmc-pack.json');
  if (fs.existsSync(mmcPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(mmcPath, 'utf-8'));
      for (const comp of data.components ?? []) {
        if (comp.uid === 'net.minecraft') {
          mc = comp.version ?? mc;
        }
        if (!loader && comp.uid === 'net.fabricmc.fabric-loader') {
          const v = comp.version;
          if (v && !/[><=]/.test(v)) {
            loader = v;
          }
        }
      }
    } catch {}
  }

  if (!loader) {
    loader = FALLBACK_LOADER;
  }

  return { mc, loader };
}

export async function resolveModMetadata(sha1: string): Promise<ModrinthMeta | null> {
  const cache = getCache();
  const cached = cache.get(sha1);
  if (cached) return cached;

  try {
    const url = `${MODRINTH_BASE}/version_file/${sha1}?algorithm=sha1`;
    const res = await fetch(url, { headers: UA_HEADERS, signal: AbortSignal.timeout(10000) });
    if (res.status !== 200) return null;

    const data: any = await res.json();
    const projectId: string | null = data.project_id ?? null;
    const version: string = data.version_number ?? '';
    const env: { client: string; server: string } = { client: 'required', server: 'optional' };
    let title: string | null = null;

    if (projectId) {
      const projRes = await fetch(`${MODRINTH_BASE}/project/${projectId}`, {
        headers: UA_HEADERS,
        signal: AbortSignal.timeout(5000),
      });
      if (projRes.ok) {
        const proj: any = await projRes.json();
        env.client = proj.client_side ?? 'required';
        env.server = proj.server_side ?? 'optional';
        title = proj.title ?? null;
      }
    }

    const downloads: string[] = [];
    let sha512: string | null = null;
    for (const f of data.files ?? []) {
      if (f.url) downloads.push(f.url);
      if (!sha512 && f.hashes?.sha512) sha512 = f.hashes.sha512;
    }

    const entry: ModrinthMeta = { downloads, sha512, env, project_id: projectId, version, title };
    cache.set(sha1, entry);
    return entry;
  } catch {
    return null;
  }
}

async function processJar(
  jarPath: string,
): Promise<{ entry: ModEntry | null; unresolvedPath: string | null }> {
  const sha1 = computeSha1(jarPath);
  const meta = await resolveModMetadata(sha1);

  if (!meta || meta.downloads.length === 0) {
    return { entry: null, unresolvedPath: jarPath };
  }

  const filename = path.basename(jarPath);
  const entry: ModEntry = {
    path: `mods/${filename}`,
    downloads: meta.downloads,
    hashes: {
      sha1,
      sha512: meta.sha512 ?? computeSha512(jarPath),
      sha256: computeSha256(jarPath),
    },
    fileSize: fs.statSync(jarPath).size,
    env: meta.env,
    filename,
    sha1,
    mod_id: getModId(jarPath),
    title: meta.title,
    version: meta.version,
  };

  return { entry, unresolvedPath: null };
}

async function asyncPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function buildIndex(
  modsDir: string,
  whitelist?: Set<string>,
): Promise<{ entries: ModEntry[]; unresolved: string[] }> {
  const entries: ModEntry[] = [];
  const unresolved: string[] = [];

  if (!fs.existsSync(modsDir)) return { entries, unresolved };

  const jars = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));

  const filtered: string[] = [];
  for (const jar of jars) {
    if (whitelist) {
      const modId = getModId(path.join(modsDir, jar));
      if ((modId && whitelist.has(modId)) || whitelist.has(jar)) {
        filtered.push(jar);
      }
    } else {
      filtered.push(jar);
    }
  }

  const fullPaths = filtered.map(j => path.join(modsDir, j));
  const results = await asyncPool(fullPaths, MAX_WORKERS, processJar);

  for (const result of results) {
    if (result.entry) {
      entries.push(result.entry);
    }
    if (result.unresolvedPath) {
      unresolved.push(result.unresolvedPath);
    }
  }

  return { entries, unresolved };
}

export async function getLatestModrinthVersion(projectId: string): Promise<string | null> {
  if (!projectId) return null;
  try {
    const res = await fetch(
      `${MODRINTH_BASE}/project/${encodeURIComponent(projectId)}/version`,
      { headers: UA_HEADERS, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const versions: any[] = await res.json();
      if (versions.length > 0) {
        return versions[0].version_number ?? null;
      }
    }
  } catch {}
  return null;
}

async function resolveLoaderVersion(root: string, configLoaderVersion?: string): Promise<string | null> {
  if (configLoaderVersion && !/[><=]/.test(configLoaderVersion)) {
    return configLoaderVersion;
  }

  const mmcPath = path.join(root, 'mmc-pack.json');
  if (fs.existsSync(mmcPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(mmcPath, 'utf-8'));
      for (const comp of data.components ?? []) {
        if (comp.uid === 'net.fabricmc.fabric-loader') {
          const v: string = comp.version ?? '';
          if (v && /[><=]/.test(v)) {
            try {
              const res = await fetch(FABRIC_META, {
                headers: UA_HEADERS,
                signal: AbortSignal.timeout(5000),
              });
              if (res.ok) {
                const loaders: any[] = await res.json();
                const stable = loaders.find(l => l.stable);
                if (stable) return stable.version;
              }
            } catch {}
          } else if (v) {
            return v;
          }
        }
      }
    } catch {}
  }

  return null;
}

function hashDirectory(dirPath: string): string {
  const h = crypto.createHash('sha256');
  const files = walkDir(dirPath).sort();
  for (const f of files) {
    const rel = path.relative(dirPath, f).replace(/\\/g, '/');
    h.update(rel);
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex');
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function scanFilesHash(
  root: string,
  includeFolders: string[],
  includeFiles: string[],
): Record<string, string> {
  const fileMap: Record<string, string> = {};

  for (const name of includeFolders) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;

    if (name === 'resourcepacks') {
      for (const child of fs.readdirSync(p, { withFileTypes: true })) {
        const childPath = path.join(p, child.name);
        const rel = path.relative(root, childPath).replace(/\\/g, '/');
        if (child.isFile()) {
          fileMap[rel] = computeSha256(childPath);
        } else if (child.isDirectory()) {
          fileMap[rel] = hashDirectory(childPath);
        }
      }
    } else {
      for (const f of walkDir(p)) {
        const rel = path.relative(root, f).replace(/\\/g, '/');
        fileMap[rel] = computeSha256(f);
      }
    }
  }

  for (const name of includeFiles) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      const rel = path.relative(root, p).replace(/\\/g, '/');
      fileMap[rel] = computeSha256(p);
    }
  }

  return fileMap;
}

export { resolveLoaderVersion };
