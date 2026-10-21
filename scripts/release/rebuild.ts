import { parseArgs, defaultRunner, type Runner } from './common';

const HELP = `Usage: bun run scripts/release/rebuild.ts --tag <vX.Y.Z> [--platforms windows|linux|macos|all] [--mode build-only|republish] [--clobber] [--execute]

Defaults to --dry-run (prints the gh command). Pass --execute to actually run.`;

export async function run(argv: string[], runner: Runner = defaultRunner): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) { console.log(HELP); return 0; }
  const tag = String(args.tag ?? '');
  if (!/^v\d+\.\d+\.\d+/.test(tag)) { console.error('Invalid or missing --tag (expected vX.Y.Z)'); return 1; }
  const platforms = String(args.platforms ?? 'all');
  if (!['windows', 'linux', 'macos', 'all'].includes(platforms)) { console.error('Invalid --platforms'); return 1; }
  const mode = String(args.mode ?? 'build-only');
  if (!['build-only', 'republish'].includes(mode)) { console.error('Invalid --mode'); return 1; }

  // verify gh auth
  const auth = await runner('gh', ['auth', 'status']);
  if (auth.code !== 0) { console.error('gh auth status failed:\n' + auth.stderr); return 1; }
  // verify tag exists
  const tagCheck = await runner('git', ['rev-parse', tag]);
  if (tagCheck.code !== 0) { console.error(`Tag ${tag} not found`); return 1; }

  const ghArgs = [
    'workflow', 'run', 'rebuild-release.yml',
    '-f', `tag=${tag}`,
    '-f', `platforms=${platforms}`,
    '-f', `mode=${mode}`,
    '-f', `clobber=${args.clobber ? 'true' : 'false'}`,
    '-f', `signing=${args.signing === false ? 'false' : 'true'}`,
  ];

  const cmd = `gh ${ghArgs.join(' ')}`;
  if (!args.execute) {
    console.log('[dry-run] Would run:');
    console.log(cmd);
    return 0;
  }
  console.log('Executing:', cmd);
  const res = await runner('gh', ghArgs);
  if (res.code !== 0) { console.error(res.stderr); return res.code; }
  console.log(res.stdout);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
