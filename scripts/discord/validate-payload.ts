import { readFileSync } from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('usage: validate-payload.ts <file.json>'); process.exit(2); }
const payload = JSON.parse(readFileSync(file, 'utf8'));
// dynamic import of validator via ts? Use a simple structural check here.
console.log('Loaded payload. Run via tests for full validation.');
console.log(JSON.stringify(payload).slice(0, 200));
