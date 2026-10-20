import { describe, it, expect } from 'vitest';
import { validateManifest } from './versions';

describe('validateManifest', () => {
  it('rejects non-object', () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest(42).valid).toBe(false);
  });
  it('accepts valid manifest', () => {
    const m = { files: [{ path: 'a.jar', hashes: { sha1: 'abc' } }] };
    expect(validateManifest(m).valid).toBe(true);
  });
  it('rejects missing files array', () => {
    expect(validateManifest({}).valid).toBe(false);
  });
  it('validates versionId', () => {
    expect(validateManifest({ files: [], versionId: 'abc' }).valid).toBe(false);
    expect(validateManifest({ files: [], versionId: 5 }).valid).toBe(true);
  });
});
