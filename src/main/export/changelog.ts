import path from 'path';
import fs from 'fs';
import type { ModEntry, ChangelogChanges } from './types';
import { scanFilesHash } from './modrinth';

function parseVersion(v: string): number[] {
  const parts = v.split('-')[0].split('.');
  return parts.map(p => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
}

function versionLessThan(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb;
  }
  return false;
}

function findPreviousManifest(
  version: string,
  isLite: boolean,
  root: string,
): string | null {
  const manifestDir = path.join(root, 'manifests');
  if (!fs.existsSync(manifestDir)) return null;

  const prefix = isLite ? 'modpack_manifest_lite_' : 'modpack_manifest_';
  const suffix = '.json';
  const currentBase = version.split('-')[0];

  let bestFile: string | null = null;
  let bestVersion = '';

  for (const f of fs.readdirSync(manifestDir)) {
    if (f.startsWith(prefix) && f.endsWith(suffix)) {
      const v = f.slice(prefix.length, -suffix.length);
      if (versionLessThan(v, currentBase) && (!bestVersion || versionLessThan(bestVersion, v))) {
        bestVersion = v;
        bestFile = path.join(manifestDir, f);
      }
    }
  }

  return bestFile;
}

function cleanResourcePackName(name: string): string {
  let n = name;
  if (n.endsWith('.zip')) n = n.slice(0, -4);
  n = n.replace(/_/g, ' ');
  return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getModDisplayName(entry: ModEntry | { filename: string; title?: string | null; version?: string | null }): string {
  if (entry.title && entry.version) {
    let ver = entry.version;
    ver = ver.replace(/^v/, '');
    return `${entry.title} (${ver})`;
  } else if (entry.title) {
    return entry.title;
  } else {
    return entry.filename.replace(/\.jar$/, '');
  }
}

export function generateChangelog(
  oldManifest: any,
  newEntries: ModEntry[],
  newUnresolved: string[],
  root: string,
  version: string,
  packName: string,
  exportDir: string,
  includeFolders: string[],
  includeFiles: string[],
): { changes: ChangelogChanges; newFiles: Record<string, string> } {
  const newModMap: Record<string, any> = {};
  for (const e of newEntries) {
    newModMap[e.filename] = e;
  }
  for (const u of newUnresolved) {
    const fn = path.basename(u);
    newModMap[fn] = { filename: fn, title: null, version: null, unresolved: true };
  }

  const oldModMap: Record<string, any> = {};
  if (oldManifest) {
    for (const m of oldManifest.mods ?? []) {
      oldModMap[m.filename] = m;
    }
  }

  const modsAdded: any[] = [];
  const modsRemoved: any[] = [];
  const modsUpdated: any[] = [];

  for (const [fn, newEntry] of Object.entries(newModMap)) {
    if (!(fn in oldModMap)) {
      modsAdded.push(newEntry);
    } else {
      const oldEntry = oldModMap[fn];
      if (newEntry.version !== oldEntry.version || newEntry.title !== oldEntry.title) {
        modsUpdated.push(newEntry);
      }
    }
  }

  for (const [fn, oldEntry] of Object.entries(oldModMap)) {
    if (!(fn in newModMap)) {
      modsRemoved.push(oldEntry);
    }
  }

  const newFiles = scanFilesHash(root, includeFolders, includeFiles);
  const oldFiles: Record<string, string> = oldManifest?.files ?? {};

  const filesAdded = Object.keys(newFiles).filter(f => !(f in oldFiles));
  const filesRemoved = Object.keys(oldFiles).filter(f => !(f in newFiles));
  const filesChanged = Object.keys(newFiles).filter(f => f in oldFiles && newFiles[f] !== oldFiles[f]);

  const rpAdded = filesAdded.filter(f => f.startsWith('resourcepacks/')).map(f => f.replace('resourcepacks/', ''));
  const rpRemoved = filesRemoved.filter(f => f.startsWith('resourcepacks/')).map(f => f.replace('resourcepacks/', ''));
  const rpChanged = filesChanged.filter(f => f.startsWith('resourcepacks/')).map(f => f.replace('resourcepacks/', ''));

  function formatMod(mod: any): string {
    if (mod.unresolved) return mod.filename;
    return getModDisplayName(mod);
  }

  function formatRp(name: string): string {
    return cleanResourcePackName(name);
  }

  const changes: ChangelogChanges = {
    added: [...modsAdded.map(formatMod), ...rpAdded.map(formatRp)].sort(),
    removed: [...modsRemoved.map(formatMod), ...rpRemoved.map(formatRp)].sort(),
    updated: [...modsUpdated.map(formatMod), ...rpChanged.map(formatRp)].sort(),
  };

  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\.\d+Z$/, '');
  const lines: string[] = [`# ${packName} ${version} (${timestamp})`, ''];

  if (changes.added.length > 0 || changes.removed.length > 0 || changes.updated.length > 0) {
    if (changes.added.length > 0) {
      lines.push('## Added');
      changes.added.forEach(m => lines.push(`- ${m}`));
      lines.push('');
    }
    if (changes.removed.length > 0) {
      lines.push('## Removed');
      changes.removed.forEach(m => lines.push(`- ${m}`));
      lines.push('');
    }
    if (changes.updated.length > 0) {
      lines.push('## Updated');
      changes.updated.forEach(m => lines.push(`- ${m}`));
      lines.push('');
    }
  } else {
    lines.push('- No tracked changes detected.');
  }

  const content = lines.join('\n');
  const outPath = path.join(exportDir, `${packName} ${version} Changelog.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf-8');

  return { changes, newFiles };
}

export { findPreviousManifest };
