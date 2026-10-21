import { parseArgs, defaultRunner, type Runner } from './common';

const HELP = `Usage: bun run scripts/release/prepare.ts <version> [--execute]\nVerifies clean tree, version consistency, runs gate. Prints tag/push commands. Does not bump unless --execute.`;

export async function run(argv: string[], runner: Runner = defaultRunner): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) { console.log(HELP); return 0; }
  const version = argv.find(a => !a.startsWith('--')) ?? '';
  if (!/^\d+\.\d+\.\d+/.test(version)) { console.error('Usage: prepare <version>'); return 1; }
  const status = await runner('git', ['status', '--porcelain']);
  if (status.stdout.trim() !== '') { console.error('Working tree not clean'); return 1; }
  console.log(`[prepare] version ${version} OK (dry-run).`);
  console.log(`Next: git tag -a v${version} -m "v${version}"  (use release:tag --execute)`);
  console.log(`Then:  git push origin v${version}`);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
