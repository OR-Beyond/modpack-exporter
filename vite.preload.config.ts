import { defineConfig } from 'vite';
import { builtinModules } from 'module';

const isSandbox = process.env.ORB_SANDBOX === '1';
const isDev = process.env.ORB_DEV === '1' || process.env.NODE_ENV === 'development';
export default defineConfig({
  define: { __SANDBOX__: JSON.stringify(isSandbox), __DEV__: JSON.stringify(isDev) },
  resolve: { conditions: ['node'], alias: { '@shared': __dirname + '/src/shared' } },
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: 'src/preload/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.cjs',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
  },
});
