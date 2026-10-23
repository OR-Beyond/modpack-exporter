import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import { migrateManifestEntries, parseCdnUrl } from './migrate';

const SHA1 = 'b'.repeat(40);
const SHA512 = 'a'.repeat(128);

function cdn(versionId = 'v1', filename = 'appleskin-fabric-mc1.21-3.0.6.jar'): string {
  return `https://cdn.modrinth.com/data/proj/versions/${versionId}/${filename}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

function versionFile(url = cdn(), opts: { sha1?: string; sha512?: string; size?: number } = {}) {
  return {
    files: [
      {
        hashes: { sha1: opts.sha1 ?? SHA1, sha512: opts.sha512 ?? SHA512 },
        size: opts.size ?? 180107,
        url,
        filename: basename(new URL(url).pathname),
        primary: true,
      },
    ],
  };
}

describe('hash resolution chain', () => {
  let root: string;
  let versionsDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'root-'));
    versionsDir = mkdtempSync(join(tmpdir(), 'ver-'));
    mkdirSync(join(root, 'mods'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(versionsDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('resolves sha512-only entry via the object-keyed version_files response (appleskin case)', async () => {
    const url = cdn();
    const manifest = {
      files: [{ path: 'mods/appleskin.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }],
    };
    const bodies: any[] = [];
    const headers: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      headers.push(init.headers);
      return jsonResponse({ [SHA512]: versionFile(url) });
    }));

    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe(SHA1);
    expect(out[0].hashes.sha512).toBe(SHA512);
    expect(out[0].fileSize).toBe(180107);
    expect(out[0].downloads).toContain(url);
    expect(out[0].verified).toBe(true);
    expect(bodies.every(b => b.algorithm === 'sha512')).toBe(true);
    expect(bodies[0].hashes).toContain(SHA512);
    expect(String(headers[0]['User-Agent'])).toMatch(/ORB-Modpack-Exporter/);
  });

  it('submits sha1 with algorithm=sha1 and still verifies with sha512', async () => {
    const url = cdn();
    const manifest = {
      files: [{ path: 'mods/a.jar', hashes: { sha1: SHA1 }, downloads: [url], fileSize: 180107 }],
    };
    const algos: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      const body = JSON.parse(init.body);
      algos.push(body.algorithm);
      if (body.algorithm === 'sha1') {
        return jsonResponse({ [SHA1]: versionFile(url) });
      }
      return jsonResponse({ [SHA512]: versionFile(url) });
    }));

    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe(SHA1);
    expect(out[0].hashes.sha512).toBe(SHA512);
    expect(algos[0]).toBe('sha1');
    expect(algos).toContain('sha512');
  });

  it('routes a local file with no download URL to overrides instead of files[]', async () => {
    writeFileSync(join(root, 'mods', 'a.jar'), Buffer.from('local-jar-bytes'));
    const manifest = {
      files: [{ path: 'mods/a.jar', hashes: {}, downloads: [], fileSize: 15 }],
    };
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out).toHaveLength(0);
    expect((out as any).warnings).toEqual([]);
  });

  it('hashes a local file when the manifest path matches exactly', async () => {
    const url = cdn();
    const bytes = Buffer.from('local-jar-bytes');
    writeFileSync(join(root, 'mods', 'a.jar'), bytes);
    const manifest = {
      files: [{ path: 'mods/a.jar', hashes: {}, downloads: [url], fileSize: bytes.length }],
    };
    const realSha1 = createHash('sha1').update(bytes).digest('hex');
    const realSha512 = createHash('sha512').update(bytes).digest('hex');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      [realSha512]: versionFile(url, { sha1: realSha1, sha512: realSha512, size: bytes.length }),
    })));
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out).toHaveLength(1);
    expect(out[0].hashes.sha1).toBe(realSha1);
    expect(out[0].hashes.sha512).toBe(realSha512);
    expect(out[0].hashes.sha512).toHaveLength(128);
    expect(out[0].fileSize).toBe(bytes.length);
    expect(out[0].source).toBe('local');
    expect(out[0].verified).toBe(true);
  });

  it('finds a versioned local jar through the download URL filename', async () => {
    const url = cdn('v1', 'appleskin-fabric-mc1.21-3.0.6.jar');
    const bytes = Buffer.from('versioned-local-jar');
    writeFileSync(join(root, 'mods', 'appleskin-fabric-mc1.21-3.0.6.jar'), bytes);
    const manifest = {
      files: [{ path: 'mods/appleskin.jar', hashes: {}, downloads: [url], fileSize: bytes.length }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0]).toHaveProperty('hashes.sha1');
    expect(out[0].fileSize).toBe(bytes.length);
    expect(out[0].source).toBe('local');
    expect(out[0].verified).toBe(false);
    expect((out as any).warnings).toHaveLength(1);
  });

  it('resolves through the CDN version lookup when no local file exists', async () => {
    const url = cdn('v42', 'appleskin-fabric-mc1.21-3.0.6.jar');
    const manifest = {
      files: [{ path: 'mods/appleskin.jar', hashes: {}, downloads: [url], fileSize: 180107 }],
    };
    vi.stubGlobal('fetch', vi.fn(async (u: string, init: any) => {
      if (u.includes('/version/')) return jsonResponse(versionFile(url));
      if (u.includes('/version_files')) {
        const body = JSON.parse(init.body);
        return jsonResponse({ [body.hashes[0]]: versionFile(url) });
      }
      return jsonResponse({}, 404);
    }));

    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe(SHA1);
    expect(out[0].hashes.sha512).toBe(SHA512);
    expect(out[0].source).toBe('modrinth-url');
    expect(out[0].verified).toBe(true);
  });

  it('reports precise causes when no hash, no local file and no URL exist', async () => {
    const manifest = { files: [{ path: 'mods/unknown.jar', hashes: {}, downloads: [], fileSize: 1 }] };
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({
        code: 'MISSING_FILE_HASH',
        causes: expect.arrayContaining(['local-file-not-found', 'entry-has-no-hash', 'download-url-missing']),
        pathsTried: expect.arrayContaining(['mods/unknown.jar']),
      }),
    });
  });

  it('never reads the versions-repo tree for local bytes', async () => {
    mkdirSync(join(versionsDir, 'overrides', 'mods'), { recursive: true });
    writeFileSync(join(versionsDir, 'overrides', 'mods', 'appleskin.jar'), Buffer.from('repo-copy'));
    const manifest = { files: [{ path: 'mods/appleskin.jar', hashes: {}, downloads: [], fileSize: 9 }] };
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({ code: 'MISSING_FILE_HASH' }),
    });
  });

  it('raises FILE_HASH_MISMATCH when the served URL differs', async () => {
    const url = cdn();
    const other = cdn('v9', 'other.jar');
    const manifest = {
      files: [{ path: 'mods/a.jar', hashes: { sha1: SHA1, sha512: SHA512 }, downloads: [url], fileSize: 180107 }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ [SHA512]: versionFile(other) })));
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({ code: 'FILE_HASH_MISMATCH', cause: 'url-not-served-by-modrinth' }),
    });
  });

  it('raises FILE_HASH_MISMATCH when the served size differs', async () => {
    const url = cdn();
    const manifest = {
      files: [{ path: 'mods/a.jar', hashes: { sha1: SHA1, sha512: SHA512 }, downloads: [url], fileSize: 1 }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ [SHA512]: versionFile(url, { size: 999 }) })));
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({ code: 'FILE_HASH_MISMATCH', cause: 'size-mismatch' }),
    });
  });

  it('ignores cache entries written by older schema versions', async () => {
    writeFileSync(join(versionsDir, '.mrpack_hash_cache.json'), JSON.stringify({
      schemaVersion: 2,
      entries: { [`sha512:${SHA512}`]: { sha1: 'c'.repeat(40), sha512: SHA512, size: 1, url: cdn() } },
    }));
    const url = cdn();
    const manifest = { files: [{ path: 'mods/a.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }] };
    let called = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { called++; return jsonResponse({ [SHA512]: versionFile(url) }); }));
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(called).toBeGreaterThan(0);
    expect(out[0].hashes.sha1).toBe(SHA1);
  });

  it('does not persist a permanent negative cache after an unknown hash', async () => {
    const url = cdn();
    const manifest = { files: [{ path: 'mods/a.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }] };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({ code: 'MISSING_FILE_HASH', causes: ['modrinth-unknown-hash'] }),
    });

    let called = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { called++; return jsonResponse({ [SHA512]: versionFile(url) }); }));
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(called).toBeGreaterThan(0);
    expect(out[0].hashes.sha1).toBe(SHA1);
  });

  it('reports modrinth-unreachable for network-only hashes', async () => {
    const url = cdn();
    const manifest = { files: [{ path: 'mods/a.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }] };
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toMatchObject({
      detail: expect.objectContaining({ code: 'MISSING_FILE_HASH', causes: ['modrinth-unreachable'] }),
    });
  });

  it('retries a 429 and then succeeds', async () => {
    const url = cdn();
    const manifest = { files: [{ path: 'mods/a.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }] };
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      n++;
      if (n === 1) return jsonResponse({}, 429);
      return jsonResponse({ [SHA512]: versionFile(url) });
    }));
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe(SHA1);
  });

  it('retries a transient network error and then succeeds', async () => {
    const url = cdn();
    const manifest = { files: [{ path: 'mods/a.jar', hashes: { sha512: SHA512 }, downloads: [url], fileSize: 180107 }] };
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      n++;
      if (n === 1) throw new Error('timeout');
      return jsonResponse({ [SHA512]: versionFile(url) });
    }));
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe(SHA1);
  });

  it('issues a bounded number of requests for 300 entries', async () => {
    const files: any[] = [];
    for (let i = 0; i < 300; i++) {
      const h = i.toString(16).padStart(128, '0').slice(-128);
      files.push({
        path: `mods/m${i}.jar`,
        hashes: { sha512: h },
        downloads: [cdn(`v${i}`, `m${i}.jar`)],
        fileSize: 100 + i,
      });
    }
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string, init: any) => {
      calls.push(u);
      const body = JSON.parse(init.body);
      const map: Record<string, any> = {};
      for (const h of body.hashes) {
        const i = parseInt(h, 16);
        map[h] = versionFile(cdn(`v${i}`, `m${i}.jar`), { sha1: SHA1, sha512: h, size: 100 + i });
      }
      return jsonResponse(map);
    }));
    const out = await migrateManifestEntries({ files }, { root, versionsDir });
    expect(out).toHaveLength(300);
    expect(calls.length).toBeLessThanOrEqual(30);
  });

  it('parses CDN URLs strictly', () => {
    expect(parseCdnUrl('https://cdn.modrinth.com/data/p/versions/v/f.jar')).toEqual({ projectId: 'p', versionId: 'v', filename: 'f.jar' });
    expect(parseCdnUrl('https://cdn.modrinth.com/x')).toBeNull();
    expect(parseCdnUrl('https://evil.com/data/p/versions/v/f.jar')).toBeNull();
  });
});
