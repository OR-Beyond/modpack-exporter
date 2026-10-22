import { isLowerHex } from './hash';

export type ViolationSeverity = 'error' | 'warning' | 'info';

export interface Violation {
  severity: ViolationSeverity;
  code: string;
  pointer: string;
  message: string;
  file?: string;
}

export interface ValidatorOptions {
  allowedHosts?: string[];
  overridesPaths?: Set<string>;
  strict?: boolean;
}

const DEFAULT_HOSTS = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com'];
const ENV_VALUES = new Set(['required', 'optional', 'unsupported']);

function isSafeInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

function isHttpsUrl(s: unknown): s is string {
  if (typeof s !== 'string' || s.length === 0) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function validateMrpackIndex(index: any, options: ValidatorOptions = {}): Violation[] {
  const violations: Violation[] = [];
  const allowedHosts = options.allowedHosts ?? DEFAULT_HOSTS;
  const overridesPaths = options.overridesPaths ?? new Set<string>();

  // Top-level
  if (!index || typeof index !== 'object' || Array.isArray(index)) {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '', message: 'Index is not an object' });
    return violations;
  }

  if (index.formatVersion !== 1) {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/formatVersion', message: 'formatVersion must be 1' });
  }
  if (index.game !== 'minecraft') {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/game', message: 'game must be "minecraft"' });
  }
  if (typeof index.versionId !== 'string' && typeof index.versionId !== 'number') {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/versionId', message: 'versionId must be present' });
  } else if (String(index.versionId).trim() === '') {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/versionId', message: 'versionId must be non-empty' });
  }
  if (typeof index.name !== 'string' || index.name.trim() === '') {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/name', message: 'name must be a non-empty string' });
  }
  if (index.summary !== undefined && typeof index.summary !== 'string') {
    violations.push({ severity: 'warning', code: 'MRPACK_INVALID_INDEX', pointer: '/summary', message: 'summary must be a string if present' });
  }

  // dependencies
  if (!index.dependencies || typeof index.dependencies !== 'object' || Array.isArray(index.dependencies)) {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/dependencies', message: 'dependencies must be an object' });
  } else {
    if (index.dependencies.minecraft === undefined) {
      violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/dependencies/minecraft', message: 'dependencies.minecraft is required' });
    }
    const loaderKeys = ['forge', 'neoforge', 'fabric-loader', 'quilt-loader'];
    const presentLoaders = loaderKeys.filter(k => index.dependencies[k] !== undefined);
    // spec: at least the loader used; but we only require minecraft. Flag unknown keys as info.
    for (const k of Object.keys(index.dependencies)) {
      if (k !== 'minecraft' && !loaderKeys.includes(k)) {
        violations.push({ severity: 'info', code: 'MRPACK_INVALID_INDEX', pointer: `/dependencies/${k}`, message: 'Unknown dependency id (allowed by spec but flagged)' });
      }
    }
    if (presentLoaders.length > 1) {
      violations.push({ severity: 'warning', code: 'MRPACK_INVALID_INDEX', pointer: '/dependencies', message: 'Multiple loader keys present' });
    }
  }

  // files
  if (!Array.isArray(index.files)) {
    violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/files', message: 'files must be an array' });
    return violations;
  }

  const seenPaths = new Set<string>();
  const seenPathsLower = new Set<string>();

  index.files.forEach((entry: any, i: number) => {
    const base = `/files/${i}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: base, message: 'Entry must be an object' });
      return;
    }

    // path
    if (typeof entry.path !== 'string' || entry.path.length === 0) {
      violations.push({ severity: 'error', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path must be a non-empty string', file: entry.path });
    } else {
      const p = entry.path;
      if (p.includes('\\')) {
        violations.push({ severity: 'error', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path must use forward slashes', file: p });
      }
      if (p.startsWith('/') || p.startsWith('\\')) {
        violations.push({ severity: 'error', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path must not start with a separator', file: p });
      }
      if (/^[a-zA-Z]:[\\/]/.test(p)) {
        violations.push({ severity: 'error', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path must not have a drive prefix', file: p });
      }
      const segments = p.split('/');
      if (segments.some((seg: string) => seg === "..")) {
        violations.push({ severity: 'error', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path must not contain ..', file: p });
      }
      if (segments.some((seg: string) => seg === "")) {
        violations.push({ severity: 'warning', code: 'UNSAFE_PATH', pointer: `${base}/path`, message: 'path contains empty segment', file: p });
      }
      // duplicate (exact)
      if (seenPaths.has(p)) {
        violations.push({ severity: 'error', code: 'DUPLICATE_PATH', pointer: `${base}/path`, message: 'duplicate path', file: p });
      }
      seenPaths.add(p);
      const lower = p.toLowerCase();
      if (seenPathsLower.has(lower)) {
        violations.push({ severity: 'error', code: 'DUPLICATE_PATH', pointer: `${base}/path`, message: 'case-colliding duplicate path', file: p });
      }
      seenPathsLower.add(lower);

      // override collision
      if (overridesPaths.has(p) || overridesPaths.has(lower)) {
        violations.push({ severity: 'error', code: 'OVERRIDE_COLLISION', pointer: `${base}/path`, message: 'path also exists in an overrides folder', file: p });
      }
    }

    // hashes
    if (!entry.hashes || typeof entry.hashes !== 'object' || Array.isArray(entry.hashes)) {
      violations.push({ severity: 'error', code: 'MISSING_FILE_HASH', pointer: `${base}/hashes`, message: 'hashes must be an object', file: entry.path });
    } else {
      const h = entry.hashes;
      if (typeof h.sha1 !== 'string' || !isLowerHex(h.sha1, 40)) {
        violations.push({ severity: 'error', code: 'MISSING_FILE_HASH', pointer: `${base}/hashes/sha1`, message: 'sha1 must be lowercase hex of length 40', file: entry.path });
      }
      if (typeof h.sha512 !== 'string' || !isLowerHex(h.sha512, 128)) {
        violations.push({ severity: 'error', code: 'MISSING_FILE_HASH', pointer: `${base}/hashes/sha512`, message: 'sha512 must be lowercase hex of length 128', file: entry.path });
      }
    }

    // fileSize
    if (!isSafeInteger(entry.fileSize)) {
      violations.push({ severity: 'error', code: 'INVALID_FILE_SIZE', pointer: `${base}/fileSize`, message: 'fileSize must be a safe integer >= 0', file: entry.path });
    }

    // downloads
    if (!Array.isArray(entry.downloads) || entry.downloads.length === 0) {
      violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `${base}/downloads`, message: 'downloads must be a non-empty array', file: entry.path });
    } else {
      entry.downloads.forEach((d: any, j: number) => {
        if (typeof d !== 'string') {
          violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `${base}/downloads/${j}`, message: 'download must be a string', file: entry.path });
          return;
        }
        if (/\s/.test(d)) {
          violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `${base}/downloads/${j}`, message: 'download URL must not contain whitespace', file: entry.path });
          return;
        }
        if (!isHttpsUrl(d)) {
          violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `${base}/downloads/${j}`, message: 'download URL must be https', file: entry.path });
          return;
        }
        const host = hostOf(d);
        if (!host || !allowedHosts.includes(host)) {
          violations.push({ severity: 'error', code: 'DISALLOWED_DOWNLOAD_HOST', pointer: `${base}/downloads/${j}`, message: `host ${host} not allowed`, file: entry.path });
        }
        // RFC3986 validity: URL constructor already validated; check no unencoded spaces handled above.
      });
    }

    // env (optional)
    if (entry.env !== undefined) {
      if (!entry.env || typeof entry.env !== 'object' || Array.isArray(entry.env)) {
        violations.push({ severity: 'error', code: 'INVALID_ENV', pointer: `${base}/env`, message: 'env must be an object', file: entry.path });
      } else {
        for (const k of ['client', 'server']) {
          if (entry.env[k] !== undefined && !ENV_VALUES.has(entry.env[k])) {
            violations.push({ severity: 'error', code: 'INVALID_ENV', pointer: `${base}/env/${k}`, message: `${k} must be required|optional|unsupported`, file: entry.path });
          }
        }
      }
    }
  });

  return violations;
}

export function validateZipEntryNames(names: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const name of names) {
    if (name.includes('\\')) {
      violations.push({ severity: 'error', code: 'PATH_TRAVERSAL_IN_ZIP', pointer: `/${name}`, message: 'ZIP entry uses backslash' });
      continue;
    }
    const segments = name.split('/');
    if (segments.some((s: string) => s === "..")) {
      violations.push({ severity: 'error', code: 'PATH_TRAVERSAL_IN_ZIP', pointer: `/${name}`, message: 'ZIP entry contains ..' });
    }
    if (name.startsWith('/') ) {
      violations.push({ severity: 'error', code: 'PATH_TRAVERSAL_IN_ZIP', pointer: `/${name}`, message: 'ZIP entry is absolute' });
    }
    if (/^[a-zA-Z]:/.test(name)) {
      violations.push({ severity: 'error', code: 'PATH_TRAVERSAL_IN_ZIP', pointer: `/${name}`, message: 'ZIP entry has drive prefix' });
    }
  }
  if (!names.includes('modrinth.index.json')) {
    violations.push({ severity: 'error', code: 'MISSING_INDEX', pointer: '/', message: 'modrinth.index.json missing at ZIP root' });
  }
  return violations;
}

export function hasErrors(violations: Violation[]): boolean {
  return violations.some(v => v.severity === 'error');
}
