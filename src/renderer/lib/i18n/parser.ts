export interface LangMeta {
  locale: string;
  nativeName: string;
  englishName: string;
  direction: 'ltr' | 'rtl';
  translators: string;
  reviewed: string;
}

export interface LangFile {
  meta: LangMeta;
  messages: Record<string, string>;
}

const META_FIELDS = ['locale', 'nativeName', 'englishName', 'direction', 'translators', 'reviewed'];

export function parseLang(source: string, file: string): LangFile {
  const meta: Partial<LangMeta> = {};
  const messages: Record<string, string> = {};
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) throw new Error(`${file}:${i + 1}: missing '=' in entry`);
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) throw new Error(`${file}:${i + 1}: empty key`);
    if (key.startsWith('@')) {
      const field = key.slice(1);
      if (!META_FIELDS.includes(field)) throw new Error(`${file}:${i + 1}: unknown metadata field '${field}'`);
      (meta as any)[field === 'nativeName' ? 'nativeName' : field === 'englishName' ? 'englishName' : field] = value;
      continue;
    }
    if (key in messages) throw new Error(`${file}:${i + 1}: duplicate key '${key}'`);
    if (value === '') throw new Error(`${file}:${i + 1}: empty value for '${key}'`);
    messages[key] = value;
  }
  const m = meta as LangMeta;
  if (!m.locale) throw new Error(`${file}: missing @locale metadata`);
  if (!m.nativeName) throw new Error(`${file}: missing @nativeName metadata`);
  if (!m.englishName) throw new Error(`${file}: missing @englishName metadata`);
  if (!m.direction) m.direction = 'ltr';
  if (!m.translators) m.translators = '';
  if (!m.reviewed) m.reviewed = 'machine-drafted, needs native review';
  return { meta: m, messages };
}
