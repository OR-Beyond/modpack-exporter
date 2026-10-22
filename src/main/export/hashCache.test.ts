import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { HashCache } from './hashCache';

describe('HashCache', () => {
  it('ignores stale schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-'));
    const p = join(dir, 'cache.json');
    writeFileSync(p, JSON.stringify({ schemaVersion: 1, entries: { 'x': { sha1: 'a', sha512: 'b', size: 1, url: null } } }));
    const c = new HashCache(p);
    expect(c.get('sha1:x')).toBeUndefined();
  });

  it('round-trips entries with matching schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-'));
    const p = join(dir, 'cache.json');
    const c = new HashCache(p);
    c.set('k', { sha1: '0'.repeat(40), sha512: '0'.repeat(128), size: 3, url: null });
    c.save();
    const c2 = new HashCache(p);
    const e = c2.get('k');
    expect(e?.size).toBe(3);
  });
});
