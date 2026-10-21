# Bun tooling

Last verified against commit HEAD.

## Why Bun
Package manager, script runner, build toolchain. Electron runs Node; no Bun-only API in src/** (ESLint enforced).

## Type strategy
tsconfig.base.json shared options. tsconfig.main.json (node types) for main/preload. tsconfig.renderer.json (DOM only). tsconfig.scripts.json (bun types). Root tsconfig.json is solution references.

## trustedDependencies
electron only (postinstall).

## Linker
[install] linker = "hoisted" in bunfig.toml for electron-builder compatibility.
