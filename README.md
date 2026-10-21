# ORB Modpack Exporter

Desktop tool for Minecraft modpack developers (Origin Realms Beyond) to sync mods/overrides, push to a Git "versions" repo, export `.mrpack` files, and notify Discord.

## Stack
Electron + Svelte 5 + TypeScript + Bun. Packaged with electron-builder.

## Requirements
- Bun >= 1.4.2
- Node >= 20 (Electron bundles its own)

## Development
```bash
bun install
bun run dev            # build + run
bun run dev:sandbox    # sandbox mode (no real side effects)
bun run build          # build main + preload + renderer
bun run typecheck      # tsc -b
bun run svelte-check   # Svelte diagnostics
bun run lint           # tsc -b
bun run test           # Vitest
bun run test:sandbox   # Vitest in sandbox mode
bun run i18n:check
bun run package        # unpacked app
bun run dist           # platform installers
```

## Downloads
Two Windows artifacts: setup (auto-update) and portable (no updater).

## Translating the app
See docs/translating.md.

## Releasing
See docs/build-and-release.md.
