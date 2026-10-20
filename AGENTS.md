# AGENTS.md — ORB Modpack Exporter

## Project purpose
Desktop tool for Minecraft modpack developers (Origin Realms Beyond) to sync mods/overrides, push to a Git "versions" repo, export `.mrpack` files, and notify Discord. Electron + Svelte 5 + TypeScript.

## Tech stack (exact)
- Electron ^42.6.0, electron-builder ^26.15.3, electron-updater ^6.8.9
- Svelte ^5.57.2 (runes only), @sveltejs/vite-plugin-svelte ^4.0.4, Vite ^5.4.21
- TypeScript ~5.4.5 (strict)
- Tailwind CSS ^3.4.19 (tokens in tailwind.config.js + globals.css)
- isomorphic-git ^1.38.6, @octokit/rest ^21.1.1, electron-store ^8.2.0, adm-zip, js-yaml
- Package manager: bun (bun.lock). Lockfile: bun.lock (package-lock.json removed).

## Commands
- `bun install` — install
- `bun run dev` — (none defined) use `bun run build && bunx electron .`
- `bun run build` — build main + preload + renderer
- `bun run build:main` / `build:preload` / `build:renderer`
- `bun run lint` — `tsc --noEmit`
- `bun run test` — Vitest
- `bun run svelte-check` — not scripted; run `bunx svelte-check`
- `bun run package` — unpacked app (`electron-builder --dir`)
- `bun run dist` — platform installers

## Repository map
- `src/main/` — Electron main process (IPC handlers, services, Git provider)
- `src/main/git/` — GitProvider interface + isomorphic-git impl
- `src/main/export/` — modrinth.index.json, changelog, packaging, orchestrator
- `src/preload/preload.ts` — typed bridge exposed as `window.electron`
- `src/renderer/` — Svelte 5 SPA
- `src/renderer/lib/components/` — UI (base/, common/, pages)
- `src/renderer/lib/state/` — `.svelte.ts` global state
- `src/renderer/lib/ipc.ts` — single typed IPC client
- `src/renderer/lib/types/` — shared types
- `electron-builder.config.cjs` — packaging
- `.github/workflows/release.yml` — release pipeline
- `docs/` — documentation
- `AGENTS.md` — this file

## Architecture
- Main process owns filesystem, Git, network, secrets. Renderer is sandboxed SPA.
- Preload exposes minimal typed `window.electron` (no raw ipcRenderer).
- IPC contract: `src/preload/preload.ts` + `src/renderer/lib/types` + handlers in `src/main/index.ts`.
- Global state in `.svelte.ts` modules with `$state`.
- All paths validated; path traversal protected.

## Mandatory conventions
- TypeScript strict. No `any`, no `as any`, no `@ts-ignore`.
- Svelte 5 runes only (see ui-guidelines.md). No legacy syntax.
- No comments except non-obvious "why".
- English only in code/docs.
- One responsibility per module; typed errors; single logger.
- Conventional Commits.

## Definition of Done (any change)
1. `tsc --noEmit` clean
2. `bunx svelte-check` 0 errors/warnings
3. ESLint clean
4. Vitest green
5. Visual diff green if UI changed
6. `bun run build` succeeds

## Git workflow
- Branch from main; never commit to main.
- Conventional Commits. Small commits. No force, no push, no tags (owner pushes).

## Security rules
- Never commit/print/log secrets. Use safeStorage for tokens.
- IPC validates payload + sender. Path traversal protected. Strict CSP.
- `shell.openExternal` only https URLs.

## Release rules
- Never tag/publish without owner. Tag format `v*`. Version must match package.json.
- Two Windows artifacts: setup (auto-update) and portable (no updater).
- Portable never initializes updater.

## How to add X
- New page: component in components/, route in App.svelte, nav in Header.
- New IPC channel: add to preload, types, handler in main, method in ipc.ts.
- New setting: store schema, settings handlers, cache entry, UI.
- New service: src/main/<name>.ts, register in index.ts.

## Known pitfalls
- Sync identity guard: every sync/push/pull must receive explicit profile identity; abort on mismatch.
- Portable builds must skip updater entirely (env PORTABLE_EXECUTABLE_FILE).
- latest.yml SHA512 must match signed installer; sign before hashing.
- Personal files (options.txt, keybindings.txt, servers.dat) never synced.

## Do NOT
- Add features/pages/themes beyond scope.
- Change UI visuals.
- Bump version or edit changelogs.
- Publish/tag/push.
