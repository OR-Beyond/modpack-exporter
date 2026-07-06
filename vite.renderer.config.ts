import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    // Use an absolute path so the output stays at <projectRoot>/.vite/renderer/main_window
    // regardless of the `root` override above — this is where electron-builder packages from.
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
});
