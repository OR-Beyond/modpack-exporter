# IPC Contract

Last verified against commit 03d77bc.

## Rule
Every channel is declared in three places: `src/preload/preload.ts`, `src/renderer/lib/types/index.ts` (Window.electron), and a handler in `src/main/index.ts`. The renderer accesses them only via `src/renderer/lib/ipc.ts`.

## Adding a channel
1. Add to preload `api`.
2. Add type to `Window.electron`.
3. Add `ipcMain.handle` in main.
4. Add method to `ipc.ts`.

## Validation
Handlers validate payload and sender. No raw `ipcRenderer` in renderer.
