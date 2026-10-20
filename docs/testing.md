# Testing

Last verified against commit 03d77bc.

## Commands
- `bun run lint` — tsc --noEmit
- `bunx svelte-check` — Svelte diagnostics
- `bun run test` — Vitest
- `bun run build` — full build

## Characterization tests
Pure/critical logic tests live alongside source as `*.test.ts` (Vitest). Cover manifest generation, diff computation, smart-merge, override selection, changelog, version bump.

## Visual tests
Playwright harness drives the Vite renderer with a mocked `window.electron`. Baselines under `tests/visual/baseline/`.
