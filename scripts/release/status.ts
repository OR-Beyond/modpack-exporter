import { parseArgs, defaultRunner, type Runner } from './common';

export async function run(argv: string[], runner: Runner = defaultRunner): Promise<number> {
  const args = parseArgs(argv);
  const tag = String(args.tag ?? '');
  if (!tag) { console.error('Usage: status --tag vX.Y.Z'); return 1; }
  const res = await runner('gh', ['run', 'list', '--workflow', 'release.yml', '--limit', '5']);
  console.log(res.stdout || res.stderr);
  const rel = await runner('gh', ['release', 'view', tag]);
  console.log(rel.stdout || rel.stderr);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
