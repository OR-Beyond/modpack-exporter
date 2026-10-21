import { writeFileSync, existsSync } from 'node:fs';
const code = process.argv[2];
if (!code) { console.error('Usage: bun run i18n:new <locale-code>'); process.exit(1); }
const path = `src/renderer/locales/${code}.lang`;
if (existsSync(path)) { console.error('Already exists:', path); process.exit(1); }
const base = readFileSyncSafe('src/renderer/locales/en.lang');
writeFileSync(path, base.replace(/^@locale = .*/m, `@locale = ${code}`).replace(/^@nativeName = .*/m, `@nativeName = ${code}`).replace(/^@englishName = .*/m, `@englishName = ${code}`).replace(/^@translators = .*/m, '@translators = machine-drafted, needs native review').replace(/^@reviewed = .*/m, '@reviewed = machine-drafted, needs native review'));
console.log('Created', path);
function readFileSyncSafe(p: string) { return require('node:fs').readFileSync(p, 'utf8'); }
