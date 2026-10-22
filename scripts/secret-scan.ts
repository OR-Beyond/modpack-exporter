import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = process.cwd();
const PATTERNS: RegExp[] = [
  /discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]{10,}/,
  /discordapp\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]{10,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];
const IGNORE = new Set(['node_modules', '.git', '.vite', 'dist', 'release']);
function walk(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
let found = 0;
for (const f of walk(ROOT)) {
  let src: string;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  for (const re of PATTERNS) {
    if (re.test(src)) {
      console.error(`SECRET PATTERN in ${relative(ROOT, f)}`);
      found++;
    }
  }
}
if (found > 0) { console.error(`secret-scan: ${found} finding(s)`); process.exit(1); }
console.log('secret-scan: clean');
