import { app, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { SANDBOX_ROOT, store } from './store';

export const isSandbox = typeof __SANDBOX__ !== 'undefined' && __SANDBOX__;

export function sandboxRoot(): string {
  return SANDBOX_ROOT;
}

/** Resolve a path and ensure it stays inside the sandbox root. Throws if it escapes. */
import { resolveSandboxPath as resolvePath } from './sandboxPath';

export function resolveSandboxPath(input: string): string {
  return resolvePath(input, SANDBOX_ROOT);
}

/** Guard an arbitrary path against traversal/symlink escape. */
export function assertInsideSandbox(input: string): void {
  resolveSandboxPath(input);
}

let guardViolations: { kind: string; detail: string; at: string }[] = [];

export function recordViolation(kind: string, detail: string): void {
  guardViolations.push({ kind, detail, at: new Date().toISOString() });
  console.error(`[sandbox-guard] ${kind}: ${detail}`);
}

export function getGuardViolations(): { kind: string; detail: string; at: string }[] {
  return [...guardViolations];
}

export function resetGuardViolations(): void {
  guardViolations = [];
}

// Static asset CDNs that are safe to load in sandbox: no data leaves the machine,
// they only fetch the bundled UI font. Everything else is treated as a violation.
const SANDBOX_ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isSandboxAllowedUrl(url: string): boolean {
  if (
    url.startsWith('file:') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('devtools:')
  ) {
    return true;
  }
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return SANDBOX_ALLOWED_HOSTS.includes(host);
  } catch {
    return false;
  }
}

/** Install the network guard: cancel any request that is not local or a static asset. */
export function installNetworkGuard(): void {
  if (!isSandbox) return;
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url || '';
      if (!isSandboxAllowedUrl(url)) {
        recordViolation('network', url);
        callback({ cancel: true });
        return;
      }
      callback({});
    });
  } catch (e) {
    recordViolation('network-setup', String(e));
  }
}

/** Ensure the sandbox root and a fake profile dir exist. */
export function ensureSandboxRoot(): void {
  if (!isSandbox) return;
  try {
    fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
    const profile = path.join(SANDBOX_ROOT, 'profile');
    fs.mkdirSync(path.join(profile, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(profile, 'overrides', 'config'), { recursive: true });
    if (!store.get('modpackRoot')) {
      store.set('modpackRoot', profile);
    }
  } catch (e) {
    recordViolation('fs-setup', String(e));
  }
}

/** Wrap fetch to block non-fake hosts in sandbox mode. */
export function guardedFetch(input: any, init?: RequestInit): Promise<Response> {
  if (isSandbox) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
    if (!allowed) {
      recordViolation('fetch', url);
      throw new Error(`Sandbox network guard blocked: ${url}`);
    }
  }
  return fetch(input as any, init);
}
