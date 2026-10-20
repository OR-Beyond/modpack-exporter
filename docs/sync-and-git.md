# Sync and Git

Last verified against commit 03d77bc.

## Storage model
- Mod `.jar` files → `modrinth.index.json` manifest (downloaded from Modrinth CDN on pull).
- Override files (configs, resource packs, shader packs, scripts) → synced via Git in versions repo.
- Personal files (`options.txt`, `keybindings.txt`, `servers.dat`) → excluded.

## Smart merge
Locally-added mods are preserved during auto-sync (never deleted).

## Identity guard (invariant)
Every sync/push/pull/export receives an explicit profile identity `{ profileId?, profilePath }`. The handler validates it matches the selected profile (`store.modpackRoot`); on mismatch it ABORTS with a typed error and never writes. Sync operations are serialized per repo via a mutex. If the selected profile changes mid-flight, the operation aborts before committing/pushing.

## Locking
Per-repo async mutex in main process (`acquireSyncLock`/`withSyncLock`).
