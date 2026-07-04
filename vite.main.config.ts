import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  resolve: { conditions: ['node'] },
  build: {
    outDir: '.vite/build',
    emptyOutDir: true,
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-updater',
        // NOTE: js-yaml and electron-store are intentionally NOT external — they're
        // pure JS and must be bundled into the main asar. Externalizing them caused a
        // runtime "Cannot find module" crash in packaged builds.
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
  },
});
