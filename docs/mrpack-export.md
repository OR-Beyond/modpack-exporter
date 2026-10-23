# mrpack export

Last verified against commit 06fef82.

## Spec digest
Modrinth modpack format (.mrpack). `modrinth.index.json` at ZIP root, UTF-8, no BOM.
Top-level: `formatVersion` (1), `game` ("minecraft"), `versionId`, `name`, optional `summary`, `files`, `dependencies`.
Each `files[]` entry: `path` (forward slashes, no `..`, no leading separator, no drive prefix), `hashes` (MUST contain `sha1` lowercase hex 40 AND `sha512` lowercase hex 128), optional `env`, `downloads` (non-empty HTTPS URLs on allowed hosts), `fileSize` (integer bytes).
Dependencies: `minecraft` + loader key (`forge`, `neoforge`, `fabric-loader`, `quilt-loader`).
Overrides folders: `overrides/`, `client-overrides/`, `server-overrides/`.

## Source of truth and resolution chain
`migrateManifestEntries` (`src/main/export/migrate.ts`) resolves legacy/partial entries in this order:
1. Both `sha1` + `sha512` already present: use them and cross-verify below.
2. Local file bytes: exact `root/<path>`, then the filename from each download URL under `root/mods`, then the entry `filename`, then a case-insensitive exact match. Only the profile root is read; the versions-repo tree is never used for local bytes.
3. Available hash: batch `POST https://api.modrinth.com/v2/version_files` with `algorithm` matching the stored hash type (`sha1` or `sha512`). The response is an object keyed by the submitted hash.
4. Download URL: parse the strict Modrinth CDN URL (`https://cdn.modrinth.com/data/<project>/versions/<version>/<filename>`), then `GET /version/{versionId}` with `GET /project/{projectId}/version` as fallback, selecting the file whose `url` matches exactly.
5. Otherwise fail with `MISSING_FILE_HASH`, including `causes` and `pathsTried` for diagnostics.

Local bytes are ground truth. If a stored hash disagrees with local bytes the export fails with `FILE_HASH_MISMATCH` (`local-hash-mismatch`); hashes are never guessed.

## Verification
Every real Modrinth CDN URL is cross-checked:

- `sha512` batch `POST /version_files` (chunks of 25), requiring exact URL, `sha1`, `sha512`, and `fileSize` equality.
- URL not served or hash unknown: `FILE_HASH_MISMATCH` with `url-not-served-by-modrinth`.
- Size disagreement: `FILE_HASH_MISMATCH` with `size-mismatch`.
- Network failure or rate limiting: non-network-only entries are exported with `verified: false` plus a warning; network-only entries fail with `MISSING_FILE_HASH` (`modrinth-unreachable` / `modrinth-rate-limited`).

Requests send an identifying `User-Agent: ORB-Modpack-Exporter/<version>`, retry transient failures with backoff, honour `Retry-After` on 429, and abort after 30s.

`source` and `verified` are internal fields; both are stripped from `modrinth.index.json` and release snapshots.

## Hash cache
Path: `<versionsRepo>/.mrpack_hash_cache.json` (gitignored). `HASH_CACHE_SCHEMA_VERSION` is `3`; other schemas are ignored. Entries may carry `files` and `expiresAt`. A persisted `null` is treated as a miss (never a permanent negative cache). The cache is only rewritten when an entry actually changed.

## Validator
`src/main/export/validator.ts` exports `validateMrpackIndex` and `validateZipEntryNames`.
Error codes: `MRPACK_INVALID_INDEX`, `FILE_HASH_MISMATCH`, `MISSING_FILE_HASH`, `DISALLOWED_DOWNLOAD_HOST`, `UNSAFE_PATH`, `DUPLICATE_PATH`, `OVERRIDE_COLLISION`, `INVALID_FILE_SIZE`, `INVALID_ENV`, `PATH_TRAVERSAL_IN_ZIP`, `MISSING_INDEX`.

## verify-mrpack
`bun run verify:mrpack <file.mrpack> [--strict] [--json [path]] [--online]`
Offline by default. `--online` performs read-only HTTPS checks (owner runs manually).

## Non-Modrinth jars
Routed to `overrides/mods/` and excluded from `files[]`. Redistributing third-party jars may be rejected by Modrinth moderation/licensing; owner decides policy.
