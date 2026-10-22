# Dev-only features

Last verified against commit HEAD.

## Logs page
The Logs page and its streaming IPC (`logs:entry`, `logs:get`, `logs:clear`) are
development-only. They are gated by `__DEV__` (build-time, from `ORB_DEV=1`) and
`!app.isPackaged` in the main process. In production bundles the page code and
the `logs:entry` channel name are eliminated (verify: `grep -rl "logs:entry" .vite`).

## Sandbox panel
Sandbox code is eliminated from production bundles via `__SANDBOX__`.

## Pseudo-locale
`en-XA` is only loaded in dev builds.

## Verification
Run `bun run build` (without ORB_DEV) and scan `.vite` for the channel names.
