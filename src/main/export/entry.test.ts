import { describe, it, expect } from 'vitest';
import { createManifestFileEntry, normalizeEntryPath } from './entry';

describe('normalizeEntryPath', () => {
  it('converts backslashes', () => {
    expect(normalizeEntryPath('mods\\a.jar')).toBe('mods/a.jar');
  });
  it('strips leading separators', () => {
    expect(normalizeEntryPath('/mods/a.jar')).toBe('mods/a.jar');
  });
  it('rejects traversal', () => {
    expect(() => normalizeEntryPath('../evil.jar')).toThrow();
  });
  it('rejects drive prefix', () => {
    expect(() => normalizeEntryPath('C:/x.jar')).toThrow();
  });
});

describe('createManifestFileEntry', () => {
  it('creates canonical entry with required hashes', () => {
    const e = createManifestFileEntry({
      path: 'mods\\a.jar',
      sha1: '0'.repeat(40),
      sha512: '0'.repeat(128),
      downloads: ['https://cdn.modrinth.com/x'],
      fileSize: 5,
    });
    expect(e.path).toBe('mods/a.jar');
    expect(e.hashes.sha1).toHaveLength(40);
    expect(e.hashes.sha512).toHaveLength(128);
  });

  it('throws on invalid sha1', () => {
    expect(() => createManifestFileEntry({
      path: 'mods/a.jar',
      sha1: 'zzz',
      sha512: '0'.repeat(128),
      downloads: [],
      fileSize: 5,
    })).toThrow();
  });
});
