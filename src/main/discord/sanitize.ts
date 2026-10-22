const CONTROL = /[\u0000-\u001f\u007f]/g;

export function stripControl(s: string): string {
  return s.replace(CONTROL, '');
}

export function escapeDiscordMarkdown(s: string): string {
  return s.replace(/([*_`~|\\>])/g, '\\$1');
}

export function neutralizeMentions(s: string): string {
  return s.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/<@!?&?\d+>/g, m => m.replace('<', '<\u200b'));
}

export function sanitizeText(s: string, max = 200): string {
  let out = stripControl(s);
  out = neutralizeMentions(out);
  if (out.length > max) out = out.slice(0, max - 1) + '…';
  return out;
}

export function sanitizeName(s: string, max = 80): string {
  return sanitizeText(escapeDiscordMarkdown(s), max);
}

export function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}
