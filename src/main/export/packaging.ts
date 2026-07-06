import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import type { ModEntry } from './types';

function fnmatchToRegex(pattern: string): RegExp {
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      regexStr += '.*';
    } else if (c === '?') {
      regexStr += '.';
    } else if (c === '[') {
      let j = i + 1;
      let negate = false;
      if (pattern[j] === '!' || pattern[j] === '^') {
        negate = true;
        j++;
      }
      let classStr = '[';
      if (negate) classStr += '^';
      while (j < pattern.length && pattern[j] !== ']') {
        const ch = pattern[j];
        if (/[-\^\\\]$|(){}[\]]/.test(ch)) {
          classStr += '\\' + ch;
        } else {
          classStr += ch;
        }
        j++;
      }
      classStr += ']';
      regexStr += classStr;
      i = j;
    } else {
      regexStr += c.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  regexStr += '$';
  return new RegExp(regexStr);
}

export function matchesAny(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (fnmatchToRegex(pattern).test(name)) return true;
  }
  return false;
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function copyRecursive(
  src: string,
  dst: string,
  excludeSubfolders?: Record<string, string[]>,
  parentKey?: string,
): void {
  if (!fs.existsSync(src)) return;

  const currentKey = parentKey ?? path.basename(src);

  if (fs.statSync(src).isFile()) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return;
  }

  fs.mkdirSync(dst, { recursive: true });

  const exclusions: string[] = [];
  if (excludeSubfolders) {
    const baseExclusions = excludeSubfolders[path.basename(src)] ?? [];
    const parentExclusions = parentKey && excludeSubfolders[parentKey] ? excludeSubfolders[parentKey] : [];
    exclusions.push(...baseExclusions, ...parentExclusions);
  }

  for (const child of fs.readdirSync(src, { withFileTypes: true })) {
    if (child.isDirectory() && exclusions.includes(child.name)) {
      continue;
    }
    const childSrc = path.join(src, child.name);
    const childDst = path.join(dst, child.name);
    const newParent = parentKey ? `${parentKey}/${child.name}` : child.name;
    copyRecursive(childSrc, childDst, excludeSubfolders, newParent);
  }
}

export function writeIndex(
  stageDir: string,
  packName: string,
  packVersion: string,
  entries: ModEntry[],
  mcVer: string,
  loaderVer: string,
): void {
  const index = {
    formatVersion: 1,
    game: 'minecraft',
    name: packName,
    versionId: packVersion,
    dependencies: { minecraft: mcVer, 'fabric-loader': loaderVer },
    files: entries,
  };

  fs.writeFileSync(
    path.join(stageDir, 'modrinth.index.json'),
    JSON.stringify(index, null, 2),
    'utf-8',
  );
}

export function packageMrpack(stageDir: string, outputPath: string): string {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const zip = new AdmZip();

  zip.addFile(
    'modrinth.index.json',
    fs.readFileSync(path.join(stageDir, 'modrinth.index.json')),
  );

  const overrideRoot = path.join(stageDir, 'overrides');
  if (fs.existsSync(overrideRoot)) {
    for (const f of walkDir(overrideRoot)) {
      const relPath = path.relative(stageDir, f).replace(/\\/g, '/');
      zip.addFile(relPath, fs.readFileSync(f));
    }
  }

  zip.writeZip(outputPath);
  return outputPath;
}

export function updateSimpleUpdateChecker(root: string, version: string, modrinthId: string): void {
  const p = path.join(root, 'config', 'simpleupdatechecker_modpack.json');
  if (!fs.existsSync(p)) return;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    data.version_id = version;
    data.display_version = version;
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export function updateFancyMenu(root: string): void {
  const p = path.join(root, 'config', 'fancymenu', 'user_variables.db');
  if (!fs.existsSync(p)) return;
  try {
    const content = fs.readFileSync(p, 'utf-8');
    const lines = content.split(/\r?\n/);
    const newLines: string[] = [];
    let inside = false;
    for (const line of lines) {
      if (line.includes('name = rp_prompt')) {
        inside = true;
        newLines.push(line);
      } else if (inside && line.includes('value =')) {
        if (line.includes('true')) {
          newLines.push(line.replace('true', 'false'));
        } else {
          newLines.push(line);
        }
        inside = false;
      } else {
        newLines.push(line);
      }
      if (inside && line.includes('name =') && !line.includes('rp_prompt')) {
        inside = false;
      }
    }
    const newContent = newLines.join('\n');
    if (newContent !== content) {
      fs.writeFileSync(p, newContent, 'utf-8');
    }
  } catch {}
}

export function updateOptions(root: string): void {
  const p = path.join(root, 'options.txt');
  if (!fs.existsSync(p)) return;
  try {
    const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/);
    const newLines: string[] = [];
    let changed = false;
    for (const line of lines) {
      if (line.startsWith('guiScale:') && line.split(':')[1]?.trim() !== '0') {
        newLines.push('guiScale:0');
        changed = true;
      } else {
        newLines.push(line);
      }
    }
    if (changed) {
      fs.writeFileSync(p, newLines.join('\n'), 'utf-8');
    }
  } catch {}
}
