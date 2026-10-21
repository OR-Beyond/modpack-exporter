import { describe, it, expect } from 'vitest';
import { resolveSandboxPath, isInsideSandbox, sandboxRootPath } from './sandboxPath';

describe('sandboxPath', () => {
  const root = '/tmp/orb-exporter-sandbox';
  it('accepts paths inside root', () => {
    expect(resolveSandboxPath(root + '/profile/mods/a.jar', root)).toBe(root + '/profile/mods/a.jar');
  });
  it('rejects traversal', () => {
    expect(() => resolveSandboxPath(root + '/../etc/passwd', root)).toThrow();
  });
  it('rejects absolute outside', () => {
    expect(() => resolveSandboxPath('/etc/passwd', root)).toThrow();
  });
  it('isInsideSandbox reports correctly', () => {
    expect(isInsideSandbox(root + '/x', root)).toBe(true);
    expect(isInsideSandbox('/etc/passwd', root)).toBe(false);
  });
  it('sandboxRootPath joins', () => {
    expect(sandboxRootPath('/tmp')).toBe('/tmp/orb-exporter-sandbox');
  });
});
