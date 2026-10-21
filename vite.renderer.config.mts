import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { langPlugin } from './src/renderer/lib/i18n/langPlugin';
import path from 'path';

const isSandbox = process.env.ORB_SANDBOX === '1';
export default defineConfig({
  define: { __SANDBOX__: JSON.stringify(isSandbox) },
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  plugins: [svelte(), langPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
});
