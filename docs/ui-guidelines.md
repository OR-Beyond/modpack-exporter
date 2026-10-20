# UI Guidelines

Last verified against commit 03d77bc.

## Svelte 5 rules
Runes only: $state, $derived, $effect, $props, $bindable. No legacy syntax (no `export let`, no `$:`, no `on:`, no `<slot>`, no `createEventDispatcher`, no `svelte/store` writable unless forced).

## Shared state
`.svelte.ts` modules with $state. Typed and minimal.

## Components
Base components in `src/renderer/lib/components/base/`. Tailwind tokens from `tailwind.config.js` + `globals.css`. Do not change tokens.

## Visual regression
Baselines under `tests/visual/baseline/`. Diff script with pixelmatch, threshold <= 0.1% anti-aliasing noise.
