import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'src/renderer';
function walk(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.svelte')) out.push(p);
  }
  return out;
}
let issues = 0;
for (const f of walk(dir)) {
  const src = readFileSync(f, 'utf8');
  // find text nodes between tags with letters (rough)
  const re = />\s*([A-Za-z][^<{]{3,})\s*</g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const text = m[1].trim();
    if (text && !text.startsWith('{') && !/^[A-Z0-9_]+$/.test(text)) {
      // allow if contains interpolation? flag anyway
      console.warn(`WARN ${f}: possible hard-coded text: "${text.slice(0, 60)}"`);
      issues++;
    }
  }
}
console.log(`i18n:lint: ${issues} potential hard-coded string(s).`);
// if (issues > 0) process.exit(1); // warn-only until full extraction
