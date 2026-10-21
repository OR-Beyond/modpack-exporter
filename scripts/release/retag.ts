import { parseArgs, defaultRunner, type Runner } from './common';

export async function run(argv: string[], runner: Runner = defaultRunner): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) { console.log('Usage: bun run scripts/release/retag.ts --tag vX.Y.Z --to <commit> --execute --i-understand-this-moves-the-tag [--force-published]'); return 0; }
  const tag = String(args.tag ?? '');
  const to = String(args.to ?? '');
  if (!/^v\d+\.\d+\.\d+/.test(tag)) { console.error('Invalid --tag'); return 1; }
  if (!to) { console.error('Missing --to'); return 1; }
  if (!args.execute || !args['i-understand-this-moves-the-tag']) {
    console.error('Refused: requires --execute --i-understand-this-moves-the-tag');
    return 1;
  }
  if (!args['force-published']) {
    // check if release published
    const res = await runner('gh', ['release', 'view', tag, '--json', 'isDraft']);
    if (res.code === 0 && res.stdout.includes('"isDraft":false')) {
      console.error('Refused: release already published. Pass --force-published to override.');
      return 1;
    }
  }
  const del = await runner('git', ['tag', '-d', tag]);
  if (del.code !== 0) { console.error(del.stderr); return del.code; }
  const create = await runner('git', ['tag', '-a', tag, to, '-m', tag]);
  if (create.code !== 0) { console.error(create.stderr); return create.code; }
  console.log(`Moved tag ${tag} to ${to}. WARNING: clients may have cached old metadata.`);
  console.log('Prefer release:rebuild. Push with: git push origin --force-with-lease ' + tag);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
