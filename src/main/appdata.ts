import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Centralized AppData directory layout:
 *   userData/
 *   ├── cache/
 *   │   ├── mod-icons/         — cached Modrinth mod icons
 *   │   └── .modpack_exporter_cache.json  — Modrinth meta cache
 *   ├── profile-snapshots/     — SHA256 snapshot records
 *   ├── production/            — isolated prod workspace
 *   ├── versions-repo/         — cloned OR-Beyond-Versions repo
 *   ├── profile-mode.json      — 'dev' | 'prod'
 *   ├── error.log
 *   └── config.json            — electron-store
 */

function ensure(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Root userData directory (electron's app.getPath('userData')). */
export function getUserDataDir(): string {
  return app.getPath('userData');
}

/** Cache directory — for mod icons, Modrinth metadata, etc. */
export function getCacheDir(): string {
  return ensure(path.join(getUserDataDir(), 'cache'));
}

/** Mod icon cache directory. */
export function getModIconsCacheDir(): string {
  return ensure(path.join(getCacheDir(), 'mod-icons'));
}

/** Profile snapshots directory. */
export function getSnapshotsDir(): string {
  return ensure(path.join(getUserDataDir(), 'profile-snapshots'));
}

/** Production workspace directory (isolated copy of the dev profile). */
export function getProductionDir(): string {
  return ensure(path.join(getUserDataDir(), 'production'));
}

/** Versions repo clone directory. */
export function getVersionsRepoDir(): string {
  return path.join(getUserDataDir(), 'versions-repo');
}

/** Path to the profile-mode file. */
export function getProfileModePath(): string {
  return path.join(getUserDataDir(), 'profile-mode.json');
}
