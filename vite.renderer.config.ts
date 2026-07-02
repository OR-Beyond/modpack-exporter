import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The @electron-forge/plugin-vite renderer defaults (see the plugin's
// vite.renderer.config.ts) set `root` to the PROJECT root and
// `build.outDir` to the RELATIVE path '.vite/renderer/main_window', then merge
// this user config on top. Two things must be corrected here:
//
//  1. `root` — index.html lives in src/renderer, not the project root, so root
//     must point there or Vite can't find the entry HTML. But because outDir is
//     relative, changing root also moves the build output: Vite would emit the
//     renderer to src/renderer/.vite/renderer/... while Forge packages the
//     PROJECT-root .vite/. The renderer would never make it into the asar and
//     the packaged app shows a blank window. So we also pin outDir to an
//     absolute path at the project root.
//
//  2. `base` — must be './' so the built index.html references assets relatively
//     (./assets/…). Under the file:// protocol used by the packaged app, the
//     Vite default of '/' resolves to the filesystem root and 404s. The Forge
//     plugin already sets this, but we set it explicitly so a plain `vite build`
//     (outside Forge) is correct too.
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    // Absolute so it stays at <projectRoot>/.vite/renderer/main_window
    // regardless of the `root` override above — this is where Forge packages from.
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
});
