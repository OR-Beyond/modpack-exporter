import { defineConfig } from 'vite';
import { builtinModules } from 'module';

const isSandbox = process.env.ORB_SANDBOX === '1';
const isDev = process.env.ORB_DEV === '1' || process.env.NODE_ENV === 'development';
export default defineConfig({
  define: { __SANDBOX__: JSON.stringify(isSandbox), __DEV__: JSON.stringify(isDev) },
  resolve: { conditions: ['node'], alias: { '@main': __dirname + '/src/main', '@shared': __dirname + '/src/shared' } },
  build: {
    outDir: '.vite/build',
    emptyOutDir: true,
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.cjs',
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
