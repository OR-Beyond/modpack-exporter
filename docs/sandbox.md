# Sandbox mode

Last verified against commit HEAD.

## Purpose
Safe test bench: exercise every exporter UI flow with zero risk to real modpack/repos/services.

## Activation
`bun run dev:sandbox` sets ORB_SANDBOX=1. Build-time define __SANDBOX__ dead-code-eliminates sandbox code from production bundles.

## Guards
1. Network: session webRequest cancels non-loopback/file requests; main fetch wrapper throws.
2. Filesystem: all paths resolve under <tmp>/orb-exporter-sandbox/.
3. Storage: separate electron-store file/cwd; real tokens never loaded.

## Scenario engine
Scenario picker in the Sandbox panel (bottom-right). Reset violations supported.

## Production bundle check
`grep -rl "getViolations\|Sandbox panel" .vite` must return nothing in a production build.
