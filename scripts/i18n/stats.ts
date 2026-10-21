import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLang } from '../../src/renderer/lib/i18n/parser';
const dir = 'src/renderer/locales';
const files = readdirSync(dir).filter(f => f.endsWith('.lang'));
const parsed = files.map(f => ({ file: f, ...parseLang(readFileSync(join(dir, f), 'utf8'), join(dir, f)) }));
const baseKeys = Object.keys(parsed.find(p => p.meta.locale === 'en')!.messages);
for (const p of parsed) {
  const cov = Math.round((Object.keys(p.messages).length / baseKeys.length) * 100);
  console.log(`${p.meta.locale.padEnd(8)} ${Object.keys(p.messages).length}/${baseKeys.length} (${cov}%)  ${p.meta.reviewed}`);
}
