import { parseArgs, defaultRunner, type Runner } from './common';

export async function run(argv: string[], runner: Runner = defaultRunner): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) { console.log('Usage: bun run scripts/release/tag.ts <version> [--execute]'); return 0; }
  const version = argv.find(a => !a.startsWith('--')) ?? '';
  if (!/^\d+\.\d+\.\d+/.test(version)) { console.error('Usage: tag <version>'); return 1; }
  if (!args.execute) {
    console.log(`[dry-run] Would create annotated tag v${version}. Pass --execute to create.`);
    return 0;
  }
  const res = await runner('git', ['tag', '-a', `v${version}`, '-m', `v${version}`]);
  if (res.code !== 0) { console.error(res.stderr); return res.code; }
  console.log(`Created tag v${version}`);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
