import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { hashFile, hashBuffer, isLowerHex } from './hash';

describe('hashFile', () => {
  it('computes sha1 and sha512 in one pass with correct size', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'h-'));
    const p = join(dir, 'a.bin');
    const data = Buffer.from('hello world');
    writeFileSync(p, data);
    const r = await hashFile(p);
    expect(r.size).toBe(11);
    expect(r.sha1).toBe('2aae6c35c94fcfb415dbe95f408b9ce91ee846ed');
    expect(r.sha512).toHaveLength(128);
    expect(isLowerHex(r.sha1, 40)).toBe(true);
    expect(isLowerHex(r.sha512, 128)).toBe(true);
    // hashBuffer matches
    const hb = hashBuffer(data);
    expect(hb.sha1).toBe(r.sha1);
    expect(hb.sha512).toBe(r.sha512);
    unlinkSync(p);
  });

  it('aborts via AbortSignal', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'h-'));
    const p = join(dir, 'big.bin');
    writeFileSync(p, Buffer.alloc(1024 * 1024, 1));
    const ac = new AbortController();
    const promise = hashFile(p, { signal: ac.signal });
    ac.abort();
    await expect(promise).rejects.toThrow();
    unlinkSync(p);
  });
});
