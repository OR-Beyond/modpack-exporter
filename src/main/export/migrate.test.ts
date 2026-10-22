import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { migrateManifestEntries } from './migrate';

describe('migrateManifestEntries', () => {
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

  it('keeps entries that already have both hashes', async () => {
    const entry = {
      path: 'mods/a.jar',
      hashes: { sha1: '0'.repeat(40), sha512: '0'.repeat(128) },
      downloads: ['https://cdn.modrinth.com/x'],
      fileSize: 5,
    };
    const manifest = { files: [entry] };
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toHaveLength(40);
    expect(out[0].hashes.sha512).toHaveLength(128);
  });

  it('hashes local file when present', async () => {
    const data = Buffer.from('hello');
    writeFileSync(join(root, 'mods', 'b.jar'), data);
    const entry: any = {
      path: 'mods/b.jar',
      hashes: { sha512: '0'.repeat(128) },
      downloads: ['https://cdn.modrinth.com/x'],
      fileSize: 5,
    };
    entry.hashes = {};
    const manifest = { files: [entry] };
    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toHaveLength(40);
    expect(out[0].hashes.sha512).toHaveLength(128);
    expect(out[0].fileSize).toBe(5);
  });

  it('resolves via API when local file absent', async () => {
    const sha512 = 'f'.repeat(128);
    const entry = {
      path: 'mods/c.jar',
      hashes: { sha512 },
      downloads: [],
      fileSize: 7,
    };
    const manifest = { files: [entry] };

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ([{
        files: [{
          hashes: { sha1: '1'.repeat(40), sha512 },
          size: 7,
          url: 'https://cdn.modrinth.com/data/x/versions/y/c.jar',
        }],
      }]),
    })));

    const out = await migrateManifestEntries(manifest, { root, versionsDir });
    expect(out[0].hashes.sha1).toBe('1'.repeat(40));
    expect(out[0].downloads).toContain('https://cdn.modrinth.com/data/x/versions/y/c.jar');
  });

  it('throws MISSING_FILE_HASH when no hash and no local file', async () => {
    const entry = { path: 'mods/d.jar', hashes: {}, downloads: [], fileSize: 1 };
    const manifest = { files: [entry] };
    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toThrow(/No hash available/);
  });

  it('throws FILE_HASH_MISMATCH when API hash disagrees with known hash', async () => {
    const sha512 = 'f'.repeat(128);
    const entry = { path: 'mods/e.jar', hashes: { sha512 }, downloads: [], fileSize: 7 };
    const manifest = { files: [entry] };

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ([{
        files: [{
          hashes: { sha1: '1'.repeat(40), sha512: 'f'.repeat(128) },
          size: 999,
          url: 'https://cdn.modrinth.com/x',
        }],
      }]),
    })));

    await expect(migrateManifestEntries(manifest, { root, versionsDir })).rejects.toThrow(/size mismatch/);
  });
});
