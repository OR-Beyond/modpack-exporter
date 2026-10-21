import path from 'path';

export const SANDBOX_ROOT_NAME = 'orb-exporter-sandbox';

export function sandboxRootPath(tmpRoot: string): string {
  return path.join(tmpRoot, SANDBOX_ROOT_NAME);
}

export function resolveSandboxPath(input: string, root: string): string {
  const resolved = path.resolve(input);
  const r = path.resolve(root);
  if (resolved !== r && !resolved.startsWith(r + path.sep)) {
    throw new Error(`Sandbox filesystem guard: path escapes sandbox root: ${input}`);
  }
  return resolved;
}

export function isInsideSandbox(input: string, root: string): boolean {
  try {
    resolveSandboxPath(input, root);
    return true;
  } catch {
    return false;
  }
}
