import path from 'path';
import fs from 'fs';
import { hashFile, isLowerHex } from './hash';
import { createManifestFileEntry } from './entry';
import { MrpackError } from './errors';
import { HashCache, HASH_CACHE_SCHEMA_VERSION } from './hashCache';

export interface MigrationContext {
  root: string;
  versionsDir: string;
  signal?: AbortSignal;
}

const API_BASE = 'https://api.modrinth.com/v2';
const UA = 'ORB-Modpack-Exporter/1.0';

function availableHash(entry: any): { algo: 'sha1' | 'sha512'; value: string } | null {
  const h = entry?.hashes;
  if (!h || typeof h !== 'object') return null;
  if (typeof h.sha1 === 'string' && isLowerHex(h.sha1, 40)) return { algo: 'sha1', value: h.sha1 };
  if (typeof h.sha512 === 'string' && isLowerHex(h.sha512, 128)) return { algo: 'sha512', value: h.sha512 };
  return null;
}

function localCandidates(entry: any, ctx: MigrationContext): string[] {
  const p = String(entry?.path ?? '');
  const base = path.basename(p);
  return [
    path.join(ctx.root, p),
    path.join(ctx.versionsDir, 'overrides', p),
    path.join(ctx.versionsDir, 'overrides', 'mods', base),
    path.join(ctx.root, 'mods', base),
  ];
}

function extrasOf(entry: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(entry ?? {})) {
    if (k === 'path' || k === 'hashes' || k === 'downloads' || k === 'fileSize' || k === 'env') continue;
    out[k] = entry[k];
  }
  return out;
}

async function batchResolve(
  hashes: string[],
  algorithm: 'sha1' | 'sha512',
  versionsDir: string,
  signal?: AbortSignal,
): Promise<Map<string, { sha1: string; sha512: string; size: number; url: string | null }>> {
  const result = new Map<string, { sha1: string; sha512: string; size: number; url: string | null }>();
  const cache = new HashCache(path.join(versionsDir, '.mrpack_hash_cache.json'));
  const toFetch: string[] = [];
  for (const h of hashes) {
    const cached = cache.get(`${algorithm}:${h}`);
    if (cached === undefined) {
      toFetch.push(h);
    } else if (cached) {
      result.set(h, cached);
    }
    // null cached => not found, skip
  }

  const chunkSize = 25;
  for (let i = 0; i < toFetch.length; i += chunkSize) {
    const chunk = toFetch.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const res = await fetch(`${API_BASE}/version_files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ hashes: chunk, algorithm }),
      signal: signal ?? AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      throw new MrpackError({ code: 'MISSING_FILE_HASH', detail: `Modrinth API returned ${res.status}` });
    }
    const data: any = await res.json();
    const versions = Array.isArray(data) ? data : [data];
    for (const v of versions) {
      for (const f of v?.files ?? []) {
        const h = f?.hashes?.[algorithm];
        if (typeof h === 'string' && chunk.includes(h)) {
          const info = {
            sha1: String(f.hashes?.sha1 ?? ''),
            sha512: String(f.hashes?.sha512 ?? ''),
            size: Number(f.size ?? 0),
            url: f.url ? String(f.url) : null,
          };
          result.set(h, info);
          cache.set(`${algorithm}:${h}`, info.sha1 && info.sha512 ? info : null);
        }
      }
    }
    for (const h of chunk) {
      if (!result.has(h)) {
        cache.set(`${algorithm}:${h}`, null);
      }
    }
  }
  cache.save();
  return result;
}

export async function migrateManifestEntries(manifest: any, ctx: MigrationContext): Promise<any[]> {
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new MrpackError({ code: 'MRPACK_INVALID_INDEX', detail: 'manifest.files must be an array' });
  }

  const entries = manifest.files;
  const resolved: any[] = [];
  const pendingApi: { entry: any; avail: { algo: 'sha1' | 'sha512'; value: string } }[] = [];

  for (const f of entries) {
    const avail = availableHash(f);
    const bothPresent =
      f?.hashes &&
      typeof f.hashes.sha1 === 'string' && isLowerHex(f.hashes.sha1, 40) &&
      typeof f.hashes.sha512 === 'string' && isLowerHex(f.hashes.sha512, 128);

    if (bothPresent) {
      const dl = Array.isArray(f.downloads) ? f.downloads : [];
      if (dl.length === 0) {
        // No allowed download -> route via overrides, not files[].
        continue;
      }
      const ne = createManifestFileEntry({
        path: f.path,
        sha1: f.hashes.sha1,
        sha512: f.hashes.sha512,
        downloads: dl,
        fileSize: Number.isSafeInteger(f.fileSize) ? f.fileSize : 0,
        env: f.env,
        ...extrasOf(f),
      });
      resolved.push({ ...ne, ...extrasOf(f) });
      // ensure fileSize from original if valid
      if (Number.isSafeInteger(f.fileSize) && f.fileSize >= 0) {
        (resolved[resolved.length - 1] as any).fileSize = f.fileSize;
      }
      continue;
    }

    // try local file
    let hashed = false;
    for (const cand of localCandidates(f, ctx)) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          const h = await hashFile(cand, { signal: ctx.signal });
          if (avail) {
            const known = avail.algo === 'sha1' ? h.sha1 : h.sha512;
            if (known !== avail.value) {
              throw new MrpackError({
                code: 'FILE_HASH_MISMATCH',
                file: String(f?.path),
                detail: `local hash mismatch for ${f?.path}`,
                expected: avail.value,
                actual: known,
              });
            }
          }
          const downloads = Array.isArray(f.downloads) && f.downloads.length > 0 ? f.downloads : [];
          if (downloads.length === 0) {
            continue;
          }
          const ne = createManifestFileEntry({
            path: f.path,
            sha1: h.sha1,
            sha512: h.sha512,
            downloads,
            fileSize: h.size,
            env: f.env,
            ...extrasOf(f),
          });
          resolved.push({ ...ne, ...extrasOf(f) });
          hashed = true;
          break;
        }
      } catch (e) {
        if (e instanceof MrpackError) throw e;
        // ignore fs errors, try next candidate
      }
    }
    if (hashed) continue;

    if (avail) {
      pendingApi.push({ entry: f, avail });
    } else {
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `No hash available and no local file for ${f?.path}`,
      });
    }
  }

  if (pendingApi.length > 0) {
    const byAlgo = new Map<string, typeof pendingApi>();
    for (const p of pendingApi) {
      const key = p.avail.algo;
      if (!byAlgo.has(key)) byAlgo.set(key, []);
      byAlgo.get(key)!.push(p);
    }
    const resolvedMap = new Map<string, { sha1: string; sha512: string; size: number; url: string | null }>();
    for (const [algo, items] of byAlgo) {
      const hashes = [...new Set(items.map(i => i.avail.value))];
      const r = await batchResolve(hashes, algo as 'sha1' | 'sha512', ctx.versionsDir, ctx.signal);
      for (const [h, info] of r) resolvedMap.set(`${algo}:${h}`, info);
    }

    for (const { entry: f, avail } of pendingApi) {
      const info = resolvedMap.get(`${avail.algo}:${avail.value}`);
      if (!info || !info.sha1 || !info.sha512) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `Could not resolve hashes for ${f?.path}`,
        });
      }
      const returnedKnown = avail.algo === 'sha1' ? info.sha1 : info.sha512;
      if (returnedKnown !== avail.value) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(f?.path),
          detail: `API returned different ${avail.algo} for ${f?.path}`,
          expected: avail.value,
          actual: returnedKnown,
        });
      }
      if (Number.isSafeInteger(f?.fileSize) && f.fileSize >= 0 && f.fileSize !== info.size) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(f?.path),
          detail: `size mismatch for ${f?.path}`,
          expected: String(f.fileSize),
          actual: String(info.size),
        });
      }
      const downloads =
        Array.isArray(f.downloads) && f.downloads.length > 0
          ? f.downloads
          : info.url
          ? [info.url]
          : [];
      if (downloads.length === 0) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `No download url for ${f?.path}`,
        });
      }
      const ne = createManifestFileEntry({
        path: f.path,
        sha1: info.sha1,
        sha512: info.sha512,
        downloads,
        fileSize: info.size,
        env: f.env,
        ...extrasOf(f),
      });
      resolved.push({ ...ne, ...extrasOf(f) });
    }
  }

  return resolved;
}

