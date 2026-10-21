# AGENTS.md — ORB Modpack Exporter

## Project purpose
Desktop tool for Minecraft modpack developers (Origin Realms Beyond) to sync mods/overrides, push to a Git "versions" repo, export `.mrpack` files, and notify Discord. Electron + Svelte 5 + TypeScript + Bun.

## Tech stack (exact)
- Electron 42.11.18 (pinned), electron-builder 26.18.0 (pinned), electron-updater 6.8.11 (pinned)
- Svelte ^5.57.2 (runes only), @sveltejs/vite-plugin-svelte ^4.0.4, Vite ^5.4.21
- TypeScript ^5.9.3 (strict)
- Tailwind CSS ^3.4.19 (tokens in tailwind.config.cjs + globals.css)
- isomorphic-git ^1.44.3, @octokit/rest ^21.1.1, electron-store ^8.2.0, adm-zip, js-yaml
- Package manager: bun (bun.lock). Lockfile: bun.lock.

## Commands
- `bun install` — install
- `bun run dev` — build + run
- `bun run dev:sandbox` — sandbox mode (no real side effects)
- `bun run build` — build main + preload + renderer
- `bun run typecheck` / `bun run lint` — tsc -b
- `bun run svelte-check` — Svelte diagnostics
- `bun run test` — Vitest
- `bun run test:sandbox` — Vitest in sandbox mode
- `bun run i18n:check` / `i18n:lint` / `i18n:new` / `i18n:stats`
- `bun run package` — unpacked app
- `bun run dist` — platform installers

## Architecture
- Main process owns filesystem, Git, network, secrets. Renderer is sandboxed SPA.
- Bun is the package manager/script runner/build toolchain ONLY. Electron runs Node. NO Bun-only API in src/** (enforced by ESLint).
- Preload exposes minimal typed window.electron.
- IPC contract: preload + types + handlers in main + ipc.ts.
- Global state in .svelte.ts modules with $state.
- All paths validated; path traversal protected.

## Mandatory conventions
- TypeScript strict. No any, no as any, no @ts-ignore.
- Svelte 5 runes only. No legacy syntax.
- No comments except non-obvious why.
- English only in code/docs (source strings are English; translations live in src/renderer/locales/*.lang).
- One responsibility per module; typed errors; single logger.
- Conventional Commits.

## i18n rules
- Locale files: src/renderer/locales/<code>.lang. Adding a language requires only a new file.
- Keys are semantic and namespaced. Messages support {placeholders} and plural forms.
- Never translate: Git commit messages, Discord embeds, changelogs, modrinth.index.json, logs, developer logs.
- No hard-coded user-facing strings in src/** (i18n:lint). Escape hatch: comment `// i18n-ok: <reason>`.
- Main process sends typed error codes + params; renderer translates.

## Sandbox rules
- Activated via ORB_SANDBOX=1 or --sandbox. Build-time define __SANDBOX__.
- Production bundle contains no sandbox code (DCE).
- Three guard layers: network, filesystem, storage. All tested.
- Never reuse identifiers/labels of the modpack dev/production mode.

## Release rules
- Never tag/publish without owner. Tag format v*. Version must match package.json.
- Two Windows artifacts: setup (auto-update) and portable (no updater).
- Portable never initializes updater.
- Rebuild without deleting release: see docs/build-and-release.md and scripts/release/*.

## Definition of Done
1. tsc -b clean
2. bunx svelte-check 0 errors/warnings
3. ESLint clean
4. Vitest green
5. i18n:check + i18n:lint green
6. Visual diff green if UI changed
7. bun run build succeeds
8. Sandbox bundle check (production free of sandbox code)

## Git workflow
- Branch from main; never commit to main.
- Conventional Commits. Small commits. No force, no push, no tags.

## Security rules
- Never commit/print/log secrets. Use safeStorage for tokens.
- IPC validates payload + sender. Path traversal protected. Strict CSP.
- shell.openExternal only https URLs.

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

## How to add X
- New page: component in components/, route in App.svelte, nav in Header.
- New IPC channel: add to preload, types, handler in main, method in ipc.ts.
- New setting: store schema, settings handlers, cache entry, UI.
- New service: src/main/<name>.ts, register in index.ts.
- New language: add src/renderer/locales/<code>.lang only.
- New Sandbox scenario: see docs/sandbox.md.
