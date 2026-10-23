import path from 'path';
import fs from 'fs';
import { hashFile, isLowerHex } from './hash';
import { createManifestFileEntry } from './entry';
import { MrpackError } from './errors';
import { HashCache } from './hashCache';

export interface MigrationContext {
  root: string;
  versionsDir: string;
  signal?: AbortSignal;
}

const API_BASE = 'https://api.modrinth.com/v2';
const UA = 'ORB-Modpack-Exporter/2.1.8';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function availableHash(entry: any): { algo: 'sha1' | 'sha512'; value: string } | null {
  const h = entry?.hashes;
  if (!h || typeof h !== 'object') return null;
  if (typeof h.sha1 === 'string' && isLowerHex(h.sha1, 40)) return { algo: 'sha1', value: h.sha1 };
  if (typeof h.sha512 === 'string' && isLowerHex(h.sha512, 128)) return { algo: 'sha512', value: h.sha512 };
  return null;
}

export function isCdnUrl(u: unknown): u is string {
  return typeof u === 'string' && /^https:\/\/cdn\.modrinth\.com\//.test(u);
}

export interface CdnParts { projectId: string; versionId: string; filename: string }

export function parseCdnUrl(url: string): CdnParts | null {
  if (typeof url !== 'string') return null;
  const m = url.match(/^https:\/\/cdn\.modrinth\.com\/data\/([^/]+)\/versions\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, projectId, versionId, filename] = m;
  if (!projectId || !versionId || !filename) return null;
  if (projectId.includes('..') || versionId.includes('..') || filename.includes('..')) return null;
  try { decodeURIComponent(filename); } catch { return null; }
  return { projectId, versionId, filename };
}

function basenameOfUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean);
    return seg.length ? decodeURIComponent(seg[seg.length - 1]) : '';
  } catch {
    return '';
  }
}

function extrasOf(entry: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(entry ?? {})) {
    if (k === 'path' || k === 'hashes' || k === 'downloads' || k === 'fileSize' || k === 'env') continue;
    out[k] = entry[k];
  }
  return out;
}

function buildLocalCandidates(entry: any, ctx: MigrationContext, urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };
  const p = String(entry?.path ?? '');
  if (p) add(path.join(ctx.root, p));
  for (const u of urls) {
    const name = basenameOfUrl(u);
    if (name) add(path.join(ctx.root, 'mods', name));
  }
  if (typeof entry?.filename === 'string' && entry.filename) {
    add(path.join(ctx.root, 'mods', entry.filename));
  }
  if (p) {
    const base = path.basename(p);
    if (base && base !== p) add(path.join(ctx.root, 'mods', base));
  }
  return out;
}

function findExistingCaseInsensitive(target: string): string | null {
  try {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  } catch {}
  const dir = path.dirname(target);
  const base = path.basename(target);
  try {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir);
    const lower = base.toLowerCase();
    const match = entries.find(e => e.toLowerCase() === lower);
    if (match) {
      const full = path.join(dir, match);
      if (fs.statSync(full).isFile()) return full;
    }
  } catch {}
  return null;
}

async function resolveLocalFile(candidates: string[]): Promise<string | null> {
  for (const cand of candidates) {
    const resolved = findExistingCaseInsensitive(cand);
    if (resolved) return resolved;
  }
  return null;
}

function combinedSignal(caller?: AbortSignal, ms = 30000): AbortSignal {
  if (!caller) return AbortSignal.timeout(ms);
  const ac = new AbortController();
  const t = setTimeout(() => { try { ac.abort(new Error('timeout')); } catch {} }, ms);
  const onAbort = () => { try { ac.abort(); } catch {} };
  if (caller.aborted) onAbort();
  else caller.addEventListener('abort', onAbort, { once: true });
  ac.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return ac.signal;
}

async function fetchWithRetry(url: string, init: RequestInit, callerSignal?: AbortSignal, ms = 30000): Promise<Response> {
  const signal = combinedSignal(callerSignal, ms);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal });
      if (res.status === 429) {
        if (attempt < 2) {
          const ra = res.headers.get('Retry-After');
          let wait = 200 * (attempt + 1);
          if (ra) {
            const n = Number(ra);
            wait = Number.isNaN(n) ? 200 : Math.min(2000, Math.max(0, n * 1000));
          }
          await sleep(wait);
          continue;
        }
        return res;
      }
      if (res.status >= 500 && res.status < 600) {
        if (attempt < 2) {
          await sleep(100 * (attempt + 1));
          continue;
        }
        return res;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) {
        await sleep(100 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

interface ResolvedInfo { sha1: string; sha512: string; size: number; url: string | null }

interface BatchOutcome {
  ok: boolean;
  status: number;
  map: Map<string, ResolvedInfo>;
  rateLimited: boolean;
  unreachable: boolean;
}

async function batchResolveHashes(
  hashes: string[],
  algorithm: 'sha1' | 'sha512',
  ctx: MigrationContext,
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { ok: true, status: 200, map: new Map(), rateLimited: false, unreachable: false };
  if (hashes.length === 0) return outcome;
  const cache = new HashCache(path.join(ctx.versionsDir, '.mrpack_hash_cache.json'));
  const toFetch: string[] = [];
  for (const h of hashes) {
    const cached = cache.get(`${algorithm}:${h}`);
    if (cached === undefined) {
      toFetch.push(h);
    } else if (cached) {
      outcome.map.set(h, { sha1: cached.sha1, sha512: cached.sha512, size: cached.size, url: cached.url });
    }
  }

  const chunkSize = 25;
  for (let i = 0; i < toFetch.length; i += chunkSize) {
    const chunk = toFetch.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    let res: Response;
    try {
      res = await fetchWithRetry(`${API_BASE}/version_files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ hashes: chunk, algorithm }),
      }, ctx.signal, 30000);
    } catch {
      outcome.ok = false;
      outcome.unreachable = true;
      outcome.status = 0;
      return outcome;
    }
    outcome.status = res.status;
    if (res.status === 429) {
      outcome.ok = false;
      outcome.rateLimited = true;
      return outcome;
    }
    if (!res.ok) {
      outcome.ok = false;
      if (res.status >= 500) outcome.unreachable = true;
      return outcome;
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      outcome.ok = false;
      outcome.unreachable = true;
      return outcome;
    }
    const chunkSet = new Set(chunk);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const map = data as Record<string, unknown>;
      for (const h of chunk) {
        const v = map[h];
        if (!v || typeof v !== 'object') continue;
        const info = fileInfoFromVersion(v as Record<string, unknown>, h, algorithm);
        if (info && info.sha1 && info.sha512) {
          outcome.map.set(h, info);
          cache.set(`${algorithm}:${h}`, { sha1: info.sha1, sha512: info.sha512, size: info.size, url: info.url });
        }
      }
    } else if (Array.isArray(data)) {
      for (const v of data as Array<Record<string, unknown>>) {
        const files = Array.isArray(v?.files) ? v.files : [];
        for (const f of files as Array<Record<string, unknown>>) {
          const hashes = f?.hashes as Record<string, unknown> | undefined;
          const h = hashes?.[algorithm];
          if (typeof h === 'string' && chunkSet.has(h)) {
            const info = fileInfoFromObject(f);
            if (info && info.sha1 && info.sha512) {
              outcome.map.set(h, info);
              cache.set(`${algorithm}:${h}`, { sha1: info.sha1, sha512: info.sha512, size: info.size, url: info.url });
            }
          }
        }
      }
    }
  }
  cache.save();
  return outcome;
}

function fileInfoFromObject(f: Record<string, unknown>): ResolvedInfo | null {
  const hashes = f?.hashes as Record<string, unknown> | undefined;
  if (!hashes) return null;
  return {
    sha1: String(hashes.sha1 ?? ''),
    sha512: String(hashes.sha512 ?? ''),
    size: Number(f.size ?? 0),
    url: typeof f.url === 'string' ? f.url : null,
  };
}

function fileInfoFromVersion(version: Record<string, unknown>, submittedHash: string, algorithm: 'sha1' | 'sha512'): ResolvedInfo | null {
  const files = Array.isArray(version?.files) ? (version.files as Array<Record<string, unknown>>) : [];
  let file = files.find(f => {
    const hashes = f?.hashes as Record<string, unknown> | undefined;
    return hashes?.[algorithm] === submittedHash;
  });
  if (!file && files.length > 0) file = files[0];
  return file ? fileInfoFromObject(file) : null;
}

interface VersionLookup { ok: boolean; status: number; data: any | null; unreachable: boolean }

async function fetchVersionById(versionId: string, ctx: MigrationContext): Promise<VersionLookup> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${API_BASE}/version/${encodeURIComponent(versionId)}`, {
      headers: { 'User-Agent': UA },
    }, ctx.signal, 30000);
  } catch {
    return { ok: false, status: 0, data: null, unreachable: true };
  }
  if (res.status === 429) return { ok: false, status: 429, data: null, unreachable: false };
  if (res.status === 404) return { ok: false, status: 404, data: null, unreachable: false };
  if (!res.ok) return { ok: false, status: res.status, data: null, unreachable: res.status >= 500 };
  try {
    return { ok: true, status: res.status, data: await res.json(), unreachable: false };
  } catch {
    return { ok: false, status: res.status, data: null, unreachable: true };
  }
}

interface ProjectVersions { ok: boolean; status: number; data: any[] | null; unreachable: boolean }

async function fetchProjectVersions(projectId: string, ctx: MigrationContext): Promise<ProjectVersions> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${API_BASE}/project/${encodeURIComponent(projectId)}/version`, {
      headers: { 'User-Agent': UA },
    }, ctx.signal, 30000);
  } catch {
    return { ok: false, status: 0, data: null, unreachable: true };
  }
  if (res.status === 429) return { ok: false, status: 429, data: null, unreachable: false };
  if (res.status === 404) return { ok: false, status: 404, data: null, unreachable: false };
  if (!res.ok) return { ok: false, status: res.status, data: null, unreachable: res.status >= 500 };
  try {
    const data = await res.json();
    return { ok: true, status: res.status, data: Array.isArray(data) ? data : [data], unreachable: false };
  } catch {
    return { ok: false, status: res.status, data: null, unreachable: true };
  }
}

function lookupCauses(lookup: { status: number; unreachable: boolean }): string[] {
  if (lookup.unreachable) return ['modrinth-unreachable'];
  if (lookup.status === 429) return ['modrinth-rate-limited'];
  if (lookup.status === 404) return ['modrinth-unknown-hash'];
  return ['modrinth-version-lookup-failed'];
}

export async function migrateManifestEntries(manifest: any, ctx: MigrationContext): Promise<any[]> {
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new MrpackError({ code: 'MRPACK_INVALID_INDEX', detail: 'manifest.files must be an array' });
  }

  const entries = manifest.files;
  const resolved: any[] = [];
  const meta: { source: string; verified?: boolean; networkOnly: boolean }[] = [];
  const warnings: string[] = [];

  const apiPending: { f: any; avail: { algo: 'sha1' | 'sha512'; value: string }; urls: string[] }[] = [];
  const urlPending: { f: any; cdnUrl: string; urls: string[] }[] = [];

  for (const f of entries) {
    const avail = availableHash(f);
    const urls = Array.isArray(f.downloads) ? f.downloads : [];
    const bothPresent =
      f?.hashes &&
      typeof f.hashes.sha1 === 'string' && isLowerHex(f.hashes.sha1, 40) &&
      typeof f.hashes.sha512 === 'string' && isLowerHex(f.hashes.sha512, 128);

    if (bothPresent) {
      const ne = createManifestFileEntry({
        path: f.path,
        sha1: f.hashes.sha1,
        sha512: f.hashes.sha512,
        downloads: urls,
        fileSize: Number.isSafeInteger(f.fileSize) ? f.fileSize : 0,
        env: f.env,
        ...extrasOf(f),
      });
      const out = { ...ne, ...extrasOf(f) };
      if (Number.isSafeInteger(f.fileSize) && f.fileSize >= 0) out.fileSize = f.fileSize;
      resolved.push(out);
      meta.push({ source: 'entry', networkOnly: false });
      continue;
    }

    const candidates = buildLocalCandidates(f, ctx, urls);
    const localPath = await resolveLocalFile(candidates);
    let hashed = false;
    if (localPath) {
      try {
        const h = await hashFile(localPath, { signal: ctx.signal });
        if (avail) {
          const known = avail.algo === 'sha1' ? h.sha1 : h.sha512;
          if (known !== avail.value) {
            throw new MrpackError({
              code: 'FILE_HASH_MISMATCH',
              file: String(f?.path),
              detail: `local hash mismatch for ${f?.path}`,
              expected: avail.value,
              actual: known,
              cause: 'local-hash-mismatch',
            });
          }
        }
        if (urls.length > 0) {
          const ne = createManifestFileEntry({
            path: f.path,
            sha1: h.sha1,
            sha512: h.sha512,
            downloads: urls,
            fileSize: h.size,
            env: f.env,
            ...extrasOf(f),
          });
          resolved.push({ ...ne, ...extrasOf(f) });
          meta.push({ source: 'local', networkOnly: false });
        }
        hashed = true;
      } catch (e) {
        if (e instanceof MrpackError) throw e;
      }
    }
    if (hashed) continue;

    const cdnUrl = urls.find(isCdnUrl);
    if (avail) {
      apiPending.push({ f, avail, urls });
    } else if (cdnUrl) {
      urlPending.push({ f, cdnUrl, urls });
    } else {
      const pathsTried = candidates.map(c => path.relative(ctx.root, c));
      const causes: string[] = ['local-file-not-found', 'entry-has-no-hash'];
      if (urls.length === 0) causes.push('download-url-missing');
      else causes.push('download-url-unparseable');
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `No hash available and no local file for ${f?.path}`,
        causes,
        pathsTried,
      });
    }
  }

  if (apiPending.length > 0) {
    const byAlgo = new Map<string, typeof apiPending>();
    for (const p of apiPending) {
      if (!byAlgo.has(p.avail.algo)) byAlgo.set(p.avail.algo, []);
      byAlgo.get(p.avail.algo)!.push(p);
    }
    const resolvedMap = new Map<string, ResolvedInfo>();
    const outcomeByAlgo = new Map<string, BatchOutcome>();
    for (const [algo, items] of byAlgo) {
      const hashes = [...new Set(items.map(i => i.avail.value))];
      const outcome = await batchResolveHashes(hashes, algo as 'sha1' | 'sha512', ctx);
      outcomeByAlgo.set(algo, outcome);
      for (const [h, info] of outcome.map) resolvedMap.set(`${algo}:${h}`, info);
    }

    for (const { f, avail, urls } of apiPending) {
      const outcome = outcomeByAlgo.get(avail.algo)!;
      if (!outcome.ok) {
        const causes: string[] = [];
        if (outcome.rateLimited) causes.push('modrinth-rate-limited');
        else if (outcome.unreachable) causes.push('modrinth-unreachable');
        else if (outcome.status === 404) causes.push('modrinth-unknown-hash');
        else causes.push('modrinth-version-lookup-failed');
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `Could not resolve hashes for ${f?.path}`,
          causes,
        });
      }
      const info = resolvedMap.get(`${avail.algo}:${avail.value}`);
      if (!info || !info.sha1 || !info.sha512) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `Could not resolve hashes for ${f?.path}`,
          causes: ['modrinth-unknown-hash'],
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
          cause: 'hash-mismatch',
        });
      }
      if (urls.length > 0 && info.url && !urls.includes(info.url)) {
        const returnedName = basenameOfUrl(info.url);
        const storedNames = urls.map(basenameOfUrl);
        if (!storedNames.includes(returnedName)) {
          throw new MrpackError({
            code: 'FILE_HASH_MISMATCH',
            file: String(f?.path),
            detail: `API returned different file for ${f?.path}`,
            expected: urls.join(', '),
            actual: info.url,
            cause: 'url-not-served-by-modrinth',
          });
        }
      }
      if (Number.isSafeInteger(f?.fileSize) && f.fileSize >= 0 && info.size && f.fileSize !== info.size) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(f?.path),
          detail: `size mismatch for ${f?.path}`,
          expected: String(f.fileSize),
          actual: String(info.size),
          cause: 'size-mismatch',
        });
      }
      const downloads = urls.length > 0 ? urls : info.url ? [info.url] : [];
      if (downloads.length === 0) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `No download url for ${f?.path}`,
          causes: ['download-url-missing'],
        });
      }
      const ne = createManifestFileEntry({
        path: f.path,
        sha1: info.sha1,
        sha512: info.sha512,
        downloads,
        fileSize: info.size || (Number.isSafeInteger(f.fileSize) ? f.fileSize : 0),
        env: f.env,
        ...extrasOf(f),
      });
      resolved.push({ ...ne, ...extrasOf(f) });
      meta.push({ source: 'modrinth-hash', networkOnly: true });
    }
  }

  for (const { f, cdnUrl, urls } of urlPending) {
    const parsed = parseCdnUrl(cdnUrl);
    if (!parsed) {
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `Could not resolve hashes for ${f?.path}`,
        causes: ['download-url-unparseable', 'entry-has-no-hash'],
      });
    }
    const versionRes = await fetchVersionById(parsed.versionId, ctx);
    if (!versionRes.ok) {
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `Could not resolve hashes for ${f?.path}`,
        causes: lookupCauses(versionRes),
      });
    }
    let versionObj = versionRes.data;
    if (!versionObj || !Array.isArray(versionObj.files)) {
      const projRes = await fetchProjectVersions(parsed.projectId, ctx);
      if (!projRes.ok) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `Could not resolve hashes for ${f?.path}`,
          causes: lookupCauses(projRes),
        });
      }
      const found = (projRes.data ?? []).find((v: any) => Array.isArray(v.files) && v.files.some((x: any) => x.url === cdnUrl));
      if (!found) {
        throw new MrpackError({
          code: 'MISSING_FILE_HASH',
          file: String(f?.path),
          detail: `Could not resolve hashes for ${f?.path}`,
          causes: ['file-not-in-version'],
        });
      }
      versionObj = found;
    }
    const file = (versionObj.files ?? []).find((x: any) => x.url === cdnUrl);
    if (!file) {
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `Could not resolve hashes for ${f?.path}`,
        causes: ['file-not-in-version'],
      });
    }
    if (!file.hashes?.sha1 || !file.hashes?.sha512 || !isLowerHex(file.hashes.sha1, 40) || !isLowerHex(file.hashes.sha512, 128)) {
      throw new MrpackError({
        code: 'MISSING_FILE_HASH',
        file: String(f?.path),
        detail: `Could not resolve hashes for ${f?.path}`,
        causes: ['modrinth-unknown-hash'],
      });
    }
    const downloads = urls.length > 0 ? urls : [cdnUrl];
    const ne = createManifestFileEntry({
      path: f.path,
      sha1: file.hashes.sha1,
      sha512: file.hashes.sha512,
      downloads,
      fileSize: Number.isSafeInteger(file.size) ? file.size : Number.isSafeInteger(f.fileSize) ? f.fileSize : 0,
      env: f.env,
      ...extrasOf(f),
    });
    resolved.push({ ...ne, ...extrasOf(f) });
    meta.push({ source: 'modrinth-url', networkOnly: true });
  }

  const cdnIndices: number[] = [];
  resolved.forEach((e, i) => {
    const urls = Array.isArray(e.downloads) ? e.downloads : [];
    // Only a well-formed Modrinth CDN URL can be cross-checked; malformed
    // lookalikes are left unverified rather than sent to the API.
    if (urls.some((u: unknown) => isCdnUrl(u) && parseCdnUrl(u) !== null)) cdnIndices.push(i);
  });

  if (cdnIndices.length > 0) {
    const hashToIndices = new Map<string, number[]>();
    for (const i of cdnIndices) {
      const h = resolved[i]?.hashes?.sha512;
      if (typeof h === 'string' && isLowerHex(h, 128)) {
        if (!hashToIndices.has(h)) hashToIndices.set(h, []);
        hashToIndices.get(h)!.push(i);
      }
    }
    const uniqueHashes = [...hashToIndices.keys()];
    const verificationMap = new Map<string, ResolvedInfo | null>();
    let overallUnreachable = false;
    let overallRateLimited = false;
    const chunkSize = 25;
    for (let i = 0; i < uniqueHashes.length; i += chunkSize) {
      const chunk = uniqueHashes.slice(i, i + chunkSize);
      const outcome = await batchResolveHashes(chunk, 'sha512', ctx);
      for (const h of chunk) verificationMap.set(h, outcome.map.get(h) ?? null);
      if (outcome.unreachable) overallUnreachable = true;
      if (outcome.rateLimited) overallRateLimited = true;
    }

    for (const i of cdnIndices) {
      const entry = resolved[i];
      const h = entry?.hashes?.sha512;
      const urls = Array.isArray(entry.downloads) ? entry.downloads : [];
      const cdnUrl = urls.find(isCdnUrl);
      const info = typeof h === 'string' && isLowerHex(h, 128) ? verificationMap.get(h) : undefined;
      const networkOnly = !!meta[i]?.networkOnly;

      if (!info) {
        if (overallUnreachable) {
          if (networkOnly) {
            throw new MrpackError({
              code: 'MISSING_FILE_HASH',
              file: String(entry?.path),
              detail: `Could not resolve hashes for ${entry?.path}`,
              causes: ['modrinth-unreachable'],
            });
          }
          warnings.push(`Could not verify ${entry?.path} with Modrinth (unreachable); entry left unverified.`);
          meta[i].verified = false;
          continue;
        }
        if (overallRateLimited) {
          if (networkOnly) {
            throw new MrpackError({
              code: 'MISSING_FILE_HASH',
              file: String(entry?.path),
              detail: `Could not resolve hashes for ${entry?.path}`,
              causes: ['modrinth-rate-limited'],
            });
          }
          warnings.push(`Could not verify ${entry?.path} with Modrinth (rate limited); entry left unverified.`);
          meta[i].verified = false;
          continue;
        }
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(entry?.path),
          detail: `Modrinth does not serve ${cdnUrl}`,
          expected: cdnUrl ?? '',
          actual: '',
          cause: 'url-not-served-by-modrinth',
        });
      }

      if (info.url && cdnUrl && info.url !== cdnUrl) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(entry?.path),
          detail: `Modrinth returned a different file for ${entry?.path}`,
          expected: cdnUrl,
          actual: info.url,
          cause: 'url-not-served-by-modrinth',
        });
      }
      if (info.sha1 !== entry.hashes.sha1 || info.sha512 !== entry.hashes.sha512) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(entry?.path),
          detail: `hash mismatch for ${entry?.path}`,
          expected: entry.hashes.sha512,
          actual: info.sha512,
          cause: 'hash-mismatch',
        });
      }
      if (Number.isSafeInteger(entry.fileSize) && entry.fileSize >= 0 && info.size && entry.fileSize !== info.size) {
        throw new MrpackError({
          code: 'FILE_HASH_MISMATCH',
          file: String(entry?.path),
          detail: `size mismatch for ${entry?.path}`,
          expected: String(entry.fileSize),
          actual: String(info.size),
          cause: 'size-mismatch',
        });
      }
      meta[i].verified = true;
    }
  }

  resolved.forEach((e, i) => {
    e.source = meta[i]?.source ?? '';
    e.verified = meta[i]?.verified;
  });

  const out: any = resolved;
  out.warnings = warnings;
  return out;
}
