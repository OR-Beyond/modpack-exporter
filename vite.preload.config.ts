import { defineConfig } from 'vite';
import { builtinModules } from 'module';

const isSandbox = process.env.ORB_SANDBOX === '1';
export default defineConfig({
  define: { __SANDBOX__: JSON.stringify(isSandbox) },
  resolve: { conditions: ['node'] },
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
