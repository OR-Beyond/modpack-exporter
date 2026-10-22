import { describe, it, expect } from 'vitest';
import { validateMrpackIndex, validateZipEntryNames, hasErrors } from './validator';

const validEntry = {
  path: 'mods/a.jar',
  hashes: { sha1: 'a'.repeat(40).replace(/a/g, '0').slice(0, 40) || '0'.repeat(40), sha512: '0'.repeat(128) },
  downloads: ['https://cdn.modrinth.com/data/x/versions/y/a.jar'],
  fileSize: 10,
  env: { client: 'required', server: 'optional' },
};
// fix sha1 to valid hex
validEntry.hashes.sha1 = '0'.repeat(40);

const validIndex = {
  formatVersion: 1,
  game: 'minecraft',
  versionId: '1.0',
  name: 'pack',
  dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.9' },
  files: [validEntry],
};

describe('validateMrpackIndex', () => {
  it('accepts a valid index', () => {
    const v = validateMrpackIndex(validIndex);
    expect(hasErrors(v)).toBe(false);
  });

  it('rejects missing sha1', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    delete idx.files[0].hashes.sha1;
    const v = validateMrpackIndex(idx);
    expect(hasErrors(v)).toBe(true);
    expect(v.some(x => x.code === 'MISSING_FILE_HASH')).toBe(true);
  });

  it('rejects uppercase sha1', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].hashes.sha1 = 'A'.repeat(40);
    const v = validateMrpackIndex(idx);
    expect(hasErrors(v)).toBe(true);
  });

  it('rejects wrong length sha512', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].hashes.sha512 = '0'.repeat(127);
    const v = validateMrpackIndex(idx);
    expect(hasErrors(v)).toBe(true);
  });

  it('rejects disallowed host', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].downloads = ['https://evil.com/x.jar'];
    const v = validateMrpackIndex(idx);
    expect(v.some(x => x.code === 'DISALLOWED_DOWNLOAD_HOST')).toBe(true);
  });

  it('rejects http url', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].downloads = ['http://cdn.modrinth.com/x.jar'];
    const v = validateMrpackIndex(idx);
    expect(hasErrors(v)).toBe(true);
  });

  it('rejects path traversal', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].path = '../evil.jar';
    const v = validateMrpackIndex(idx);
    expect(v.some(x => x.code === 'UNSAFE_PATH')).toBe(true);
  });

  it('rejects backslash path', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].path = 'mods\\a.jar';
    const v = validateMrpackIndex(idx);
    expect(v.some(x => x.code === 'UNSAFE_PATH')).toBe(true);
  });

  it('rejects drive prefix', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].path = 'C:/mods/a.jar';
    const v = validateMrpackIndex(idx);
    expect(v.some(x => x.code === 'UNSAFE_PATH')).toBe(true);
  });

  it('rejects duplicate paths case-insensitively', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    const e2 = JSON.parse(JSON.stringify(validEntry));
    e2.path = 'MODS/A.JAR';
    idx.files.push(e2);
    const v = validateMrpackIndex(idx);
    expect(v.some(x => x.code === 'DUPLICATE_PATH')).toBe(true);
  });

  it('rejects fileSize mismatch type', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    idx.files[0].fileSize = 1.5;
    const v = validateMrpackIndex(idx);
    expect(hasErrors(v)).toBe(true);
  });

  it('rejects override collision when overridesPaths provided', () => {
    const idx = JSON.parse(JSON.stringify(validIndex));
    const v = validateMrpackIndex(idx, { overridesPaths: new Set(['mods/a.jar']) });
    expect(v.some(x => x.code === 'OVERRIDE_COLLISION')).toBe(true);
  });
});

describe('validateZipEntryNames', () => {
  it('requires modrinth.index.json at root', () => {
    const v = validateZipEntryNames(['overrides/x.txt']);
    expect(v.some(x => x.code === 'MISSING_INDEX')).toBe(true);
  });

  it('rejects traversal entry', () => {
    const v = validateZipEntryNames(['modrinth.index.json', '../evil']);
    expect(v.some(x => x.code === 'PATH_TRAVERSAL_IN_ZIP')).toBe(true);
  });
});
