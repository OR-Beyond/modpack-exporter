import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLang } from '../../src/renderer/lib/i18n/parser';

const dir = 'src/renderer/locales';
const files = readdirSync(dir).filter(f => f.endsWith('.lang'));
const parsed = files.map(f => ({ file: f, ...parseLang(readFileSync(join(dir, f), 'utf8'), join(dir, f)) })).filter(p => !p.meta.reviewed.includes('dev-only'));
const base = parsed.find(p => p.meta.locale === 'en') ?? parsed[0];
const baseKeys = Object.keys(base.messages);
let errors = 0;
function err(msg: string) { console.error('ERROR:', msg); errors++; }

for (const p of parsed) {
  if (p.meta.locale === base.meta.locale) continue;
  const keys = Object.keys(p.messages);
  for (const k of baseKeys) {
    if (!(k in p.messages)) err(`${p.file}: missing key '${k}'`);
  }
  for (const k of keys) {
    if (!(k in base.messages)) err(`${p.file}: unknown key '${k}'`);
  }
  // placeholder consistency
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const k of baseKeys) {
    if (k in p.messages && ph(base.messages[k]) !== ph(p.messages[k])) {
      err(`${p.file}: placeholder mismatch for '${k}'`);
    }
  }
  // empty values already caught by parser
}
// duplicate keys / malformed handled by parser (throws)
console.log(`Checked ${parsed.length} locales. Base: ${base.meta.locale} (${baseKeys.length} keys).`);
if (errors > 0) { console.error(`\n${errors} error(s) found.`); process.exit(1); }
console.log('i18n:check passed.');
