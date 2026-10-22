import AdmZip from 'adm-zip';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { validateMrpackIndex, validateZipEntryNames, hasErrors } from '../src/main/export/validator';
import { hashBuffer } from '../src/main/export/hash';

interface Args {
  file: string;
  strict: boolean;
  json: string | null; // null = stdout if --json without path? we'll use boolean flag
  jsonPath: string | null;
  online: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { file: '', strict: false, json: null, jsonPath: null, online: false, help: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') a.help = true;
    else if (t === '--strict') a.strict = true;
    else if (t === '--online') a.online = true;
    else if (t === '--json') {
      a.json = 'stdout';
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        a.jsonPath = argv[++i];
      }
    } else rest.push(t);
  }
  if (rest.length > 0) a.file = rest[0];
  return a;
}

function printHelp() {
  console.log(`verify-mrpack <file.mrpack> [--strict] [--json [path]] [--online]

Offline (default): validates the pack without network access.
  --strict   Treat warnings as errors.
  --json     Print JSON report to stdout (or to [path] if given).
  --online   (opt-in) Fetch download URLs and verify size + hashes. NEVER run in CI without explicit flag.
  --help     Show this help.

Exit codes: 0 = no errors, 1 = validation errors, 2 = usage error.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.file) { console.error('Missing <file.mrpack>'); printHelp(); process.exit(2); }
  if (!existsSync(args.file)) { console.error(`File not found: ${args.file}`); process.exit(2); }

  const zip = new AdmZip(args.file);
  const names = zip.getEntries().map(e => e.entryName);
  const indexEntry = zip.getEntry('modrinth.index.json');
  let index: any = null;
  const violations: any[] = [];
  if (!indexEntry) {
    violations.push({ severity: 'error', code: 'MISSING_INDEX', pointer: '/', message: 'modrinth.index.json missing at ZIP root' });
  } else {
    const raw = indexEntry.getData().toString('utf-8');
    // BOM check
    if (raw.charCodeAt(0) === 0xfeff) {
      violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/formatVersion', message: 'UTF-8 BOM present' });
    }
    try {
      index = JSON.parse(raw);
    } catch (e: any) {
      violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: '/', message: `Invalid JSON: ${e?.message}` });
    }
  }

  const overridesPaths = new Set<string>();
  for (const n of names) {
    if (n.startsWith('overrides/') || n.startsWith('client-overrides/') || n.startsWith('server-overrides/')) {
      overridesPaths.add(n);
    }
  }

  if (index) {
    violations.push(...validateMrpackIndex(index, { overridesPaths }));
  }
  violations.push(...validateZipEntryNames(names));

  // Cross-check hashes for files present in the pack
  if (index && Array.isArray(index.files)) {
    for (let i = 0; i < index.files.length; i++) {
      const f = index.files[i];
      // try to find bytes in zip under f.path or overrides/
      const candidateNames = [f.path, `overrides/${f.path}`];
      for (const cn of candidateNames) {
        const e = zip.getEntry(cn);
        if (e) {
          const h = hashBuffer(e.getData());
          if (h.sha1 !== f.hashes?.sha1) {
            violations.push({ severity: 'error', code: 'FILE_HASH_MISMATCH', pointer: `/files/${i}/hashes/sha1`, message: `sha1 mismatch for ${f.path}`, file: f.path, expected: f.hashes?.sha1, actual: h.sha1 });
          }
          if (h.sha512 !== f.hashes?.sha512) {
            violations.push({ severity: 'error', code: 'FILE_HASH_MISMATCH', pointer: `/files/${i}/hashes/sha512`, message: `sha512 mismatch for ${f.path}`, file: f.path, expected: f.hashes?.sha512, actual: h.sha512 });
          }
          if (h.size !== f.fileSize) {
            violations.push({ severity: 'error', code: 'INVALID_FILE_SIZE', pointer: `/files/${i}/fileSize`, message: `fileSize mismatch for ${f.path}` });
          }
        }
      }
    }
  }

  // --online
  if (args.online) {
    // dynamic import not needed; use fetch
    if (index && Array.isArray(index.files)) {
      for (let i = 0; i < index.files.length; i++) {
        const f = index.files[i];
        for (const url of f.downloads ?? []) {
          try {
            const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(30000) });
            if (!res.ok) {
              violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `/files/${i}/downloads`, message: `HTTP ${res.status} for ${url}` });
              continue;
            }
            const buf = Buffer.from(await res.arrayBuffer());
            const h = hashBuffer(buf);
            if (h.sha1 !== f.hashes?.sha1) violations.push({ severity: 'error', code: 'FILE_HASH_MISMATCH', pointer: `/files/${i}/hashes/sha1`, message: `remote sha1 mismatch for ${f.path}` });
            if (h.sha512 !== f.hashes?.sha512) violations.push({ severity: 'error', code: 'FILE_HASH_MISMATCH', pointer: `/files/${i}/hashes/sha512`, message: `remote sha512 mismatch for ${f.path}` });
            if (buf.length !== f.fileSize) violations.push({ severity: 'error', code: 'INVALID_FILE_SIZE', pointer: `/files/${i}/fileSize`, message: `remote size mismatch for ${f.path}` });
          } catch (e: any) {
            violations.push({ severity: 'error', code: 'MRPACK_INVALID_INDEX', pointer: `/files/${i}/downloads`, message: `fetch failed: ${e?.message}` });
          }
        }
      }
    }
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  const report = {
    file: args.file,
    errors: errors.length,
    warnings: warnings.length,
    violations,
  };

  const jsonStr = JSON.stringify(report, null, 2);
  if (args.jsonPath) {
    writeFileSync(args.jsonPath, jsonStr, 'utf-8');
  } else if (args.json) {
    console.log(jsonStr);
  } else {
    console.log(`verify-mrpack: ${args.file}`);
    console.log(`  errors: ${errors.length}, warnings: ${warnings.length}`);
    for (const v of violations) {
      console.log(`  [${v.severity}] ${v.code} ${v.pointer} ${v.message}`);
    }
  }

  const fail = errors.length > 0 || (args.strict && warnings.length > 0);
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
