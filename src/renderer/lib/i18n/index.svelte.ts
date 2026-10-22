import { parseLang } from './parser';

export type { LangFile, LangMeta } from './parser';

const modules = import.meta.glob('../../locales/*.lang', { eager: true });
const isDev = import.meta.env.DEV;

export interface LocaleEntry {
  code: string;
  meta: import('./parser').LangMeta;
  messages: Record<string, string>;
}

function codeFromPath(p: string): string {
  const m = p.match(/\/([^/]+)\.lang$/);
  return m ? m[1] : p;
}

export const locales: LocaleEntry[] = Object.entries(modules)
  .filter(([p]) => isDev || !p.includes('en-XA'))
  .map(([p, mod]: any) => ({
  code: codeFromPath(p),
  meta: mod.default.meta,
  messages: mod.default.messages,
}));

export function findLocale(code: string): LocaleEntry | undefined {
  return locales.find(l => l.code === code) ?? locales.find(l => l.code === code.split('-')[0]);
}

const STORAGE_KEY = 'orb.locale';

const initialLocale = localStorage.getItem(STORAGE_KEY) || 'en';
let currentCode = $state<string>(findLocale(initialLocale) ? initialLocale : 'en');

export const i18n = {
  get locale(): string { return currentCode; },
  setLocale(code: string) {
    if (!findLocale(code)) return;
    currentCode = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    document.documentElement.lang = code;
    document.documentElement.dir = findLocale(code)?.meta.direction ?? 'ltr';
  },
  t(key: string, params?: Record<string, string | number>): string {
    const entry = findLocale(currentCode) ?? locales[0];
    const base = findLocale('en') ?? locales[0];
    let msg = entry.messages[key];
    if (msg === undefined) {
      msg = base.messages[key];
      if (msg === undefined) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: ${key}`);
        }
        return key;
      }
      if (import.meta.env.DEV && currentCode !== 'en') {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing key in ${currentCode}: ${key}`);
      }
    }
    if (!params) return msg as string;
    return format(msg, params, currentCode);
  },
};

function format(msg: string, params: Record<string, string | number>, locale: string): string {
  // plural blocks: {var, plural, one {...} few {...} many {...} other {...}}
  msg = msg.replace(/\{(\w+),\s*plural,(.*)\}/g, (_m, varName, rest) => {
    const n = Number(params[varName]);
    let category = 'other';
    try { category = new Intl.PluralRules(locale).select(n); } catch {}
    const formRegex = new RegExp(category + '\\s*\\{([^}]*)\\}');
    let fm = rest.match(formRegex);
    if (!fm) fm = rest.match(/other\s*\{([^}]*)\}/);
    const template = fm ? fm[1] : '';
    return template.replace(/#/g, String(n));
  });
  msg = msg.replace(/\{(\w+)\}/g, (_m, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  return msg;
}

export function initI18n(_defaultLocale?: string): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && findLocale(stored)) { i18n.setLocale(stored); return; }
  i18n.setLocale('en');
}
