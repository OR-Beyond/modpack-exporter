# Architecture

Last verified against commit 03d77bc.

## Purpose
High-level structure of the ORB Modpack Exporter (Electron main/preload/renderer).

## Layers
- `src/main/` — Electron main process: IPC handlers, services (Git, Modrinth, Discord, export, sync, updater). Owns filesystem, Git, network, secrets.
- `src/preload/preload.ts` — typed bridge exposed as `window.electron`. No raw `ipcRenderer`.
- `src/renderer/` — Svelte 5 SPA. Sandboxed. Uses `src/renderer/lib/ipc.ts` as single typed client.
- `src/main/git/` — GitProvider interface + isomorphic-git impl.
- `src/main/export/` — manifest generation, changelog, packaging, orchestrator.

## Data flow
Renderer calls `ipc.*` → preload `ipcRenderer.invoke` → `ipcMain.handle` in main → services. Progress streams via `webContents.send`.

## State
- Renderer global state in `.svelte.ts` modules with ``.
- Main process state in `electron-store` (typed `StoreSchema`).
