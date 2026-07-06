import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface SyncManifestMod {
  filename: string;
  sha1?: string;
  url?: string;
  title?: string;
  version?: string;
  unresolved?: boolean;
}

export interface SyncManifest {
  generated_at: number;
  mods: SyncManifestMod[];
  files: Record<string, string>;
}

export interface SyncResult {
  downloaded: string[];
  verified: string[];
  failed: string[];
  extra: string[];
  deleted: string[];
}

export interface SyncProgress {
  type: 'progress' | 'info' | 'warn' | 'error' | 'result';
  filename?: string;
  message?: string;
  data?: SyncResult;
}

export function computeSha1(filePath: string): string {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

export function findLatestManifest(root: string): string | null {
  const manifestDir = path.join(root, 'manifests');
  try {
    if (!fs.existsSync(manifestDir)) return null;
    const candidates = fs.readdirSync(manifestDir)
      .filter(f => f.startsWith('modpack_manifest_') && f.endsWith('.json'))
      .sort();
    const standard = candidates.filter(f => !f.includes('lite'));
    const chosen = (standard.length > 0 ? standard : candidates).slice(-1)[0];
    return chosen ? path.join(manifestDir, chosen) : null;
  } catch {
    return null;
  }
}

async function downloadFile(url: string, dest: string, expectedSha1?: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    if (expectedSha1 && computeSha1(dest) !== expectedSha1) {
      try { fs.unlinkSync(dest); } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function syncMods(
  root: string,
  manifestPath?: string | null,
  autoDelete?: boolean,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const resolvedManifest = manifestPath ?? findLatestManifest(root);

  if (!resolvedManifest || !fs.existsSync(resolvedManifest)) {
    onProgress?.({ type: 'error', message: 'No manifest found. Run an export first.' });
    return { downloaded: [], verified: [], failed: [], extra: [], deleted: [] };
  }

  const modsDir = path.join(root, 'mods');
  onProgress?.({ type: 'info', message: `Using manifest: ${path.basename(resolvedManifest)}` });

  const manifest: SyncManifest = JSON.parse(fs.readFileSync(resolvedManifest, 'utf-8'));
  const mods = manifest.mods || [];

  const downloaded: string[] = [];
  const verified: string[] = [];
  const failed: string[] = [];

  let localJars = new Set<string>();
  try {
    if (fs.existsSync(modsDir)) {
      localJars = new Set(fs.readdirSync(modsDir).filter(f => f.endsWith('.jar')));
    }
  } catch {}

  const manifestNames = new Set(mods.filter(m => !m.unresolved).map(m => m.filename));

  for (const mod of mods) {
    const { filename, sha1, url } = mod;
    const dest = path.join(modsDir, filename);

    onProgress?.({ type: 'progress', filename });

    if (fs.existsSync(dest)) {
      if (sha1 && computeSha1(dest) !== sha1) {
        onProgress?.({ type: 'info', message: `Re-downloading ${filename} (SHA1 mismatch)` });
        try { fs.unlinkSync(dest); } catch {}
      } else {
        verified.push(filename);
        continue;
      }
    }

    if (!url) {
      onProgress?.({ type: 'warn', message: `No URL for ${filename}, skipping` });
      failed.push(filename);
      continue;
    }

    fs.mkdirSync(modsDir, { recursive: true });
    if (await downloadFile(url, dest, sha1)) {
      downloaded.push(filename);
    } else {
      failed.push(filename);
    }
  }

  const extra = [...localJars].filter(jar => !manifestNames.has(jar));
  const deleted: string[] = [];

  if (autoDelete) {
    for (const name of extra) {
      const p = path.join(modsDir, name);
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          deleted.push(name);
          onProgress?.({ type: 'info', message: `Deleted extra mod: ${name}` });
        }
      } catch {}
    }
  }

  const result: SyncResult = { downloaded, verified, failed, extra, deleted };
  onProgress?.({ type: 'result', data: result });
  return result;
}
