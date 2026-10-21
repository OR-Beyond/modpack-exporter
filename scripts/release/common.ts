export interface Runner {
  (cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
}

export async function defaultRunner(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, stdout, stderr };
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        out[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out[key] = argv[++i];
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

export function help(text: string): void {
  console.log(text);
}
