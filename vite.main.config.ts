import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  resolve: { conditions: ['node'] },
  build: {
    rollupOptions: {
      external: [
        'electron',
        // NOTE: js-yaml and electron-store are intentionally NOT external — they're
        // pure JS and must be bundled into the main asar. Externalizing them caused a
        // runtime "Cannot find module" crash in packaged builds.
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
  },
});
