import path from 'path';
import fs from 'fs';
import os from 'os';
import type { ExportOptions, ExportResult, ModEntry } from './types';
import { detectVersions, buildIndex, computeSha1, resolveLoaderVersion, scanFilesHash } from './modrinth';
import { generateChangelog, findPreviousManifest } from './changelog';
import { copyRecursive, writeIndex, packageMrpack, updateSimpleUpdateChecker, updateFancyMenu, updateOptions } from './packaging';

export async function buildExport(options: ExportOptions): Promise<ExportResult> {
  const { root, config, packName, version, isLite, isRelease, exportDir } = options;

  const includeFolders: string[] = config.include_folders ?? [];
  const includeFiles: string[] = config.include_files ?? [];
  const liteMods: string[] = config.lite_whitelist?.mods ?? [];
  const liteRps: string[] = config.lite_whitelist?.resource_packs ?? [];
  const modrinthId = isLite ? (config.lite_modrinth_id ?? '') : (config.modrinth_id ?? '');
  const fallbackMc: string = config.minecraft_version ?? '1.21.1';
  const configLoaderVersion: string | undefined = config.fabric_loader_version;
  const excludeSubfolders: Record<string, string[]> = config.exclude_subfolders ?? {};

  const whitelist = isLite ? new Set(liteMods) : undefined;

  const { mc: mcVer, loader: baseLoaderVer } = detectVersions(root, fallbackMc, configLoaderVersion);
  const resolvedLoader = await resolveLoaderVersion(root, configLoaderVersion);
  const loaderVer = resolvedLoader ?? baseLoaderVer;

  if (isRelease) {
    updateSimpleUpdateChecker(root, version, modrinthId);
    updateFancyMenu(root);
    updateOptions(root);
  }

  const previousManifestPath = findPreviousManifest(version, isLite, root);
  let oldManifest: any = null;
  if (previousManifestPath && fs.existsSync(previousManifestPath)) {
    try {
      oldManifest = JSON.parse(fs.readFileSync(previousManifestPath, 'utf-8'));
    } catch {}
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modpack-export-'));
  let result: string | null = null;
  let entries: ModEntry[] = [];
  let unresolved: string[] = [];
  let changes: any = null;
  let newFiles: Record<string, string> = {};

  try {
    for (const name of includeFolders) {
      const src = path.join(root, name);
      if (fs.existsSync(src)) {
        copyRecursive(src, path.join(tmpDir, 'overrides', name), excludeSubfolders);
      }
    }

    for (const name of includeFiles) {
      const src = path.join(root, name);
      if (fs.existsSync(src)) {
        copyRecursive(src, path.join(tmpDir, 'overrides', name), excludeSubfolders);
      }
    }

    const modsDir = path.join(root, 'mods');
    const indexResult = await buildIndex(modsDir, whitelist);
    entries = indexResult.entries;
    unresolved = indexResult.unresolved;

    if (isLite) {
      const rpDst = path.join(tmpDir, 'overrides', 'resourcepacks');
      if (liteRps.length > 0) {
        fs.mkdirSync(rpDst, { recursive: true });
        for (const rp of liteRps) {
          const src = path.join(root, 'resourcepacks', rp);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(rpDst, rp));
          }
        }
      } else {
        if (fs.existsSync(rpDst)) {
          fs.rmSync(rpDst, { recursive: true, force: true });
        }
        fs.mkdirSync(rpDst, { recursive: true });
      }
    }

    if (unresolved.length > 0) {
      const dstMods = path.join(tmpDir, 'overrides', 'mods');
      fs.mkdirSync(dstMods, { recursive: true });
      for (const j of unresolved) {
        fs.copyFileSync(j, path.join(dstMods, path.basename(j)));
      }
      fs.writeFileSync(
        path.join(tmpDir, 'UNRESOLVED_MODS.txt'),
        'These mods could not be resolved on Modrinth.\n',
        'utf-8',
      );
    }

    if (isRelease) {
      const changelogResult = generateChangelog(
        oldManifest, entries, unresolved, root, version, packName, exportDir,
        includeFolders, includeFiles,
      );
      changes = changelogResult.changes;
      newFiles = changelogResult.newFiles;

      const manifestDir = path.join(root, 'manifests');
      fs.mkdirSync(manifestDir, { recursive: true });
      const prefix = isLite ? 'modpack_manifest_lite_' : 'modpack_manifest_';
      const manifestPath = path.join(manifestDir, `${prefix}${version}.json`);
      const manifest: any = {
        generated_at: Date.now() / 1000,
        mods: [],
        files: newFiles,
      };
      for (const e of entries) {
        manifest.mods.push({
          filename: e.filename,
          sha1: e.hashes.sha1,
          url: e.downloads[0] ?? null,
          title: e.title,
          version: e.version,
        });
      }
      for (const j of unresolved) {
        manifest.mods.push({
          filename: path.basename(j),
          sha1: computeSha1(j),
          url: null,
          unresolved: true,
        });
      }
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    }

    writeIndex(tmpDir, packName, version, entries, mcVer, loaderVer);

    const outpath = String(path.join(exportDir, `${packName} ${version}.mrpack`));
    result = packageMrpack(tmpDir, outpath);

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  const stats = {
    total: entries.length + unresolved.length,
    resolved: entries.length,
    embedded: unresolved.length,
  };

  return {
    success: result !== null,
    outputPath: result,
    mcVersion: mcVer,
    loaderVersion: loaderVer,
    stats,
    changes,
  };
}
