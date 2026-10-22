import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { langPlugin } from './src/renderer/lib/i18n/langPlugin';
import path from 'path';

const isSandbox = process.env.ORB_SANDBOX === '1';
const isDev = process.env.ORB_DEV === '1' || process.env.NODE_ENV === 'development';
export default defineConfig({
  define: { __SANDBOX__: JSON.stringify(isSandbox), __DEV__: JSON.stringify(isDev) },
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  plugins: [svelte(), langPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer'), '@shared': path.resolve(__dirname, 'src/shared') },
  },
});
