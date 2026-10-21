import type { Plugin } from 'vite';
import { parseLang } from './parser';

export function langPlugin(): Plugin {
  return {
    name: 'lang-plugin',
    transform(code, id) {
      if (!id.endsWith('.lang')) return null;
      const parsed = parseLang(code, id);
      return { code: `export default ${JSON.stringify(parsed)};`, map: null };
    },
  };
}
