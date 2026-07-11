import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export type ProfileMode = 'dev' | 'prod';

export interface SnapshotRecord {
  id: string;
  timestamp: string;
  mode: ProfileMode;
  modCount: number;
  fileCount: number;
  files: Record<string, string>;
}

const SNAPSHOTS_DIR = 'profile-snapshots';

function snapshotsDir(userDataPath: string): string {
  const dir = path.join(userDataPath, SNAPSHOTS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function snapshotPath(userDataPath: string, id: string): string {
  return path.join(snapshotsDir(userDataPath), `${id}.json`);
}

function indexFile(userDataPath: string): string {
  return path.join(snapshotsDir(userDataPath), 'index.json');
}

function loadSnapshotIndex(userDataPath: string): SnapshotRecord[] {
  try {
    return JSON.parse(fs.readFileSync(indexFile(userDataPath), 'utf-8'));
  } catch {
    return [];
  }
}

function saveSnapshotIndex(userDataPath: string, records: SnapshotRecord[]): void {
  fs.writeFileSync(indexFile(userDataPath), JSON.stringify(records, null, 2), 'utf-8');
}

function sha256(filePath: string): string {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return '';
  }
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

export function takeSnapshot(
  userDataPath: string,
  profileRoot: string,
  mode: ProfileMode,
): SnapshotRecord {
  const modsDir = path.join(profileRoot, 'mods');
  const existing = loadSnapshotIndex(userDataPath);
  const id = `snap-${Date.now()}`;

  const allFiles = walkDir(profileRoot);
  const modFiles = fs.existsSync(modsDir) ? walkDir(modsDir) : [];

  const files: Record<string, string> = {};
  for (const fp of allFiles) {
    const rel = path.relative(profileRoot, fp);
    files[rel] = sha256(fp);
  }

  const record: SnapshotRecord = {
    id,
    timestamp: new Date().toISOString(),
    mode,
    modCount: modFiles.length,
    fileCount: allFiles.length,
    files,
  };

  fs.writeFileSync(snapshotPath(userDataPath, id), JSON.stringify(record, null, 2), 'utf-8');
  existing.push(record);
  saveSnapshotIndex(userDataPath, existing);
  return record;
}

export function listSnapshots(userDataPath: string): SnapshotRecord[] {
  return loadSnapshotIndex(userDataPath).map(r => ({
    ...r,
    files: {},
  }));
}

export function getSnapshot(userDataPath: string, id: string): SnapshotRecord | null {
  try {
    return JSON.parse(fs.readFileSync(snapshotPath(userDataPath, id), 'utf-8'));
  } catch {
    return null;
  }
}

export function restoreSnapshot(
  userDataPath: string,
  id: string,
  profileRoot: string,
): { success: boolean; error?: string } {
  const record = getSnapshot(userDataPath, id);
  if (!record) return { success: false, error: 'Snapshot not found' };

  for (const [relPath, expectedHash] of Object.entries(record.files)) {
    const fullPath = path.join(profileRoot, relPath);
    const currentHash = sha256(fullPath);
    if (currentHash && currentHash !== expectedHash) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      const snapshotFile = snapshotPath(userDataPath, id);
      try {
        const snapData = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
        if (snapData.fileContents?.[relPath]) {
          fs.writeFileSync(fullPath, Buffer.from(snapData.fileContents[relPath], 'base64'));
        }
      } catch {}
    }
  }

  return { success: true };
}

export function getProfileMode(userDataPath: string): ProfileMode {
  try {
    const modeFile = path.join(userDataPath, 'profile-mode.json');
    const raw = fs.readFileSync(modeFile, 'utf-8').trim();
    if (raw === 'prod') return 'prod';
    return 'dev';
  } catch {
    return 'dev';
  }
}

export function setProfileMode(userDataPath: string, mode: ProfileMode): void {
  fs.writeFileSync(path.join(userDataPath, 'profile-mode.json'), mode, 'utf-8');
}

export function productionWorkspacePath(userDataPath: string): string {
  return path.join(userDataPath, 'production');
}

export function promoteToProduction(
  userDataPath: string,
  sourceProfile: string,
): { success: boolean; copiedMods: number; copiedFiles: number; error?: string } {
  const target = productionWorkspacePath(userDataPath);
  fs.mkdirSync(target, { recursive: true });

  let copiedMods = 0;
  let copiedFiles = 0;

  const copyDir = (src: string, dst: string) => {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        copyDir(s, d);
      } else if (entry.isFile()) {
        fs.copyFileSync(s, d);
        if (entry.name.endsWith('.jar')) copiedMods++;
        else copiedFiles++;
      }
    }
  };

  copyDir(sourceProfile, target);
  return { success: true, copiedMods, copiedFiles };
}
