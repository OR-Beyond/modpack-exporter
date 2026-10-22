# mrpack export

Last verified against commit 06fef82.

## Spec digest
Modrinth modpack format (.mrpack). `modrinth.index.json` at ZIP root, UTF-8, no BOM.
Top-level: `formatVersion` (1), `game` ("minecraft"), `versionId`, `name`, optional `summary`, `files`, `dependencies`.
Each `files[]` entry: `path` (forward slashes, no `..`, no leading separator, no drive prefix), `hashes` (MUST contain `sha1` lowercase hex 40 AND `sha512` lowercase hex 128), optional `env`, `downloads` (non-empty HTTPS URLs on allowed hosts), `fileSize` (integer bytes).
Dependencies: `minecraft` + loader key (`forge`, `neoforge`, `fabric-loader`, `quilt-loader`).
Overrides folders: `overrides/`, `client-overrides/`, `server-overrides/`.

## Source of truth
- Local file bytes available: hashes computed from bytes are ground truth. Modrinth API disagreement => `FILE_HASH_MISMATCH`.
- Stored manifest only: use stored `sha1`/`sha512`; never guess.
- Legacy entries (missing one hash): migrate lazily (local file -> hash; else Modrinth API via available hash; else fail `MISSING_FILE_HASH`).

## Validator
`src/main/export/validator.ts` exports `validateMrpackIndex` and `validateZipEntryNames`.
Error codes: `MRPACK_INVALID_INDEX`, `FILE_HASH_MISMATCH`, `MISSING_FILE_HASH`, `DISALLOWED_DOWNLOAD_HOST`, `UNSAFE_PATH`, `DUPLICATE_PATH`, `OVERRIDE_COLLISION`, `INVALID_FILE_SIZE`, `INVALID_ENV`, `PATH_TRAVERSAL_IN_ZIP`, `MISSING_INDEX`.

## verify-mrpack
`bun run verify:mrpack <file.mrpack> [--strict] [--json [path]] [--online]`
Offline by default. `--online` performs read-only HTTPS checks (owner runs manually).

## Non-Modrinth jars
Routed to `overrides/mods/` and excluded from `files[]`. Redistributing third-party jars may be rejected by Modrinth moderation/licensing; owner decides policy.
