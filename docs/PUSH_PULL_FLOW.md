# Push / Pull / Export Flow

Step-by-step algorithms for the app's three core operations. All three live in
`src/main/index.ts`; see [IPC_HANDLERS.md](./IPC_HANDLERS.md) for exact channel names/payloads and
[STORAGE_MODEL.md](./STORAGE_MODEL.md) for the file formats referenced below.

Every one of these guards against `readOnlyMode` and a missing `modpackRoot` up front (push/pull
do; export resolves its root via profile mode and fails if that's unset), takes a profile snapshot
before touching anything (`takeSnapshot`), and streams progress events (`sync:progress` for
git ops, `export:progress` for export ops) as `{ stage, message, percent }`.

## Push (`git:push`)

1. **Sync the versions repo** (2%) — `ensureVersionsRepo(versionsDir, token)`: clones
   `OR-Beyond/OR-Beyond-Versions` into `<userData>/versions-repo` if it isn't there yet, or
   fetches + hard-resets to `origin/main` if it is. Pre-checks GitHub API access to the repo first
   (clear 401/404 error messages) so auth problems don't surface as opaque git errors.
2. **Resolve git identity** — fetches the authenticated GitHub username via Octokit (falls back to
   `'orbmodpack'`), sets `user.name`/`user.email` on the versions-repo clone if not already set
   (`ensureGitIdentity`).
3. **Scan mods/** (8%) — lists every `.jar` in `<modpackRoot>/mods`.
4. **Load the Modrinth hash cache** (`.modrinth_cache.json`, sha512-keyed — see STORAGE_MODEL.md).
5. **Load the existing manifest** — `versionId` becomes `previousVersionId + 1`.
6. **Resolve each jar** (10–55%, progress per file) — for every jar:
   - Compute sha512. Hash failure → recorded in `modsUnresolved`, skipped.
   - `lookupModrinthHash(sha512, filename, cache)`: cache hit or a live Modrinth API lookup
     (`GET /v2/version_file/{sha512}` → `GET /v2/project/{projectId}`), cached either way (misses
     included, so an unrecognized jar isn't re-queried every push).
   - **Found on Modrinth** → manifest entry referencing the CDN `downloads[0]` URL; the local jar
     bytes are *not* copied anywhere.
   - **Not found** ("local"/unresolved mod) → the jar is copied into
     `<versions-repo>/overrides/mods/<filename>`, the manifest entry gets `"source": "local"` and
     empty `downloads`, and the filename is added to `modsUnresolved`.
   - Before this loop, any stale jar in `overrides/mods/` that no longer exists locally is
     deleted.
7. **Diff against the previous manifest** by identity (CDN `projectId`, or basename fallback — see
   STORAGE_MODEL.md) to compute `modsAdded` (count) and `removedMods[]` (full details: slug, name,
   version, icon, from the cache).
8. **Write `modrinth.index.json`** — built *only* from this push's `newFiles`, never merged with
   the previous manifest (so genuinely-deleted mods disappear rather than reappearing on a future
   pull). Runs `validateManifest()`; a failure here aborts the whole push before anything is
   committed.
9. **Sync override folders** (58%) — `syncOverridesToRepo()` copies changed files from
   `<modpackRoot>/<OVERRIDE_FOLDER>` into `<versions-repo>/overrides/<folder>` (respecting the
   `ESSENTIAL_EXCLUDE` list), plus a sweep pass that deletes anything else under `overrides/`
   (outside the defined folder/file scope, excluding `overrides/mods/`) whose local counterpart no
   longer exists.
10. **Stage and commit** (80%) — `ensureGitignore()` first. Change detection compares `head` vs.
    `workdir` from a **pre-stage** `statusMatrix()` snapshot (deliberately taken *before*
    `addAll()` — after staging, every untouched tracked file also gets a non-zero stage value, so
    comparing post-stage `stage !== 0` would report "changes" on every push regardless of whether
    anything actually differed from HEAD). If real changes are found, commits with the user's
    message (or `Modpack push v<newVersion>` if left blank).
11. **Push** (92%) — on a `'no upstream'`-style error (first push to a brand-new remote), retries
    once; any other error propagates and fails the whole operation.
12. **Fetch the resulting commit** — `gitProvider.log(depth:1)` → `{ sha, message, author, timestamp }`,
    returned to the renderer as `commit` on the response so the activity feed can show it
    immediately without waiting on a GitHub API refetch.
13. **Discord webhook** (fire-and-forget, doesn't block the response) — posts one embed per
    added/updated/removed mod (icon + Modrinth description + version), batched to ≤10 embeds per
    call, plus a header embed and a changed-files embed. Hardcoded webhook URL + role ping live
    directly in `index.ts`.

Returns `{ success: true, version, modsAdded, modsRemoved, removedMods, modsUnresolved,
filesChanged, commit }` or `{ success: false, error }`.

### Push preview (`git:push-preview`)

A read-only dry run of steps 6–9's *diffing* logic — no commit, no push, no writes to the versions
repo at all. Scans local `mods/` and override folders, compares against the current manifest/repo
state on disk, and returns the same shape of `addedMods`/`updatedMods`/`removedMods`/`changedFiles`
the real push would produce, plus `unchangedCount` and `isFirstPush` (true if no manifest exists
yet). This is what `PushModal` shows the user before they confirm.

## Pull (`git:pull`)

1. **Cleanup** — delete a stale `.git/index.lock` if a previous run crashed mid-operation.
2. **Snapshot pre-pull state** — the old manifest's `files[]` and the current local jar filenames,
   for later diffing.
3. **Sync the versions repo** (5%) — same `ensureVersionsRepo()` as push.
4. **Read and validate the manifest** (15%) — missing file, invalid JSON, missing `files` array,
   or a `validateManifest()` failure all abort the pull with a specific error message *before* any
   local file is touched, to protect the user's existing install.
5. **Load pull state** (`.last_pull_state.json` — see STORAGE_MODEL.md).
6. **Determine first-pull vs. smart-merge**: a pull is a **first pull** only if *both*
   `.last_pull_state.json` is missing *and* `<modpackRoot>/mods/` currently has zero jars. This
   dual condition specifically avoids treating "the state file was lost" the same as "this is a
   genuinely fresh install" — losing the state file alone falls through to smart-merge instead of
   wiping a populated profile.

### Branch A — First pull (clean install)

1. Delete every `.jar` in `mods/`.
2. Recursively delete `config`, `resourcepacks`, `shaderpacks`, `scripts`, `essential`,
   `fancymenu_data`, `data`, `keybind_presets`, `configureddefaults` under the modpack root
   (`FIRST_PULL_WIPE_FOLDERS`).
3. For every manifest entry: copy from `overrides/mods/<name>` if `source === 'local'`, otherwise
   download `downloads[0]` from the Modrinth CDN. Duplicate/conflicting jars are removed first
   (`removeConflictingJars`).
4. Copy everything under `<versions-repo>/overrides/` (excluding `mods/`) into the modpack root,
   building the new `.last_pull_state.json` baseline as it goes.

Every mod is reported as "added" (there's nothing to diff against) — no smart-merge bookkeeping
runs on this branch.

### Branch B — Smart merge (normal pull)

1. Compute `locallyAddedSlugs` — jars present locally before this pull that *aren't* in the old
   manifest, i.e. mods the user added but hasn't pushed yet. These are protected from deletion
   throughout the rest of the pull.
2. **Sync mods** (15–55%) — for each manifest entry, find the matching local jar by slug; copy
   (local source) or download (Modrinth source) only if the hash differs or the file's missing.
3. **Remove stale mods** (57%) — any jar in `mods/` not present in the manifest is deleted,
   *unless* its slug is in `locallyAddedSlugs`, in which case it's left alone and reported in
   `preservedMods` instead. This is the "smart merge" the app advertises: un-pushed local work
   survives a pull.
4. **Sync override files** (62%) — for each override folder, the three-way comparison described in
   STORAGE_MODEL.md's `.last_pull_state.json` section: overwrite only if the local file matches
   the last-known pull state (i.e. the user hasn't edited it); otherwise skip and report in
   `filesSkipped` rather than clobbering local edits.

### Both branches — final steps

- **Duplicate sweep** (59%) — regardless of which branch ran, groups all jars in `mods/` by a
  version-stripped slug; if two+ jars share a slug and the expected sha512 is known, deletes every
  jar that doesn't match it, keeping exactly one correct copy. This is what prevents the
  "downloaded a new jar before deleting the old one" duplicate-jar bug from recurring.
- **Persist state** (100%) — writes the new `.last_pull_state.json`, updates the `lastPullTime`
  setting.
- **Build the enriched result** — `addedMods`/`updatedMods`/`removedMods` with full display info
  (name, icon, version) computed purely from the cache + manifest diff (no extra network calls),
  merged with any jars actually downloaded/deleted during the duplicate sweep that weren't already
  captured.

Returns `{ success: true, pulled: true, modsDownloaded, modsRemoved, modsSkipped, filesUpdated,
filesSkipped, errors, addedMods, updatedMods, removedMods, preservedMods, changedFiles }` or
`{ success: false, error }`. `PullResultPopup` renders this.

## Undo last push (`git:undo-last-push`)

1. Sync the versions repo, resolve git identity.
2. Require at least one commit to exist (`gitProvider.log(depth:1)`) — otherwise
   `'No commits to undo.'`.
3. **Revert** (20%) — `revertLastCommit()`: a hand-implemented revert (isomorphic-git has no
   built-in revert). Diffs `HEAD` against its parent, then for each changed path: deletes files
   that were added, restores the parent's blob for files that were removed or modified. Creates a
   new commit on top (message `Revert <sha7>`) — this is a forward-moving revert, not a history
   rewrite.
4. **Push the revert** (40%) — retries once on a missing-upstream error, same as a normal push.
5. **Re-sync local mods to the reverted manifest** (55–82%) — same download/copy/remove-stale
   pattern as pull, reconciling `mods/` against whatever the manifest looked like after the
   revert.
6. **Re-sync override files** (87%, `essential/` skipped) — copies files from the reverted
   `overrides/<folder>` back to the modpack root, deletes local files no longer present.

Returns `{ success: true, message: 'Last push has been undone.' }` or `{ success: false, error }`.

## Export

There are **two different export code paths** in this codebase — see ARCHITECTURE.md's "notable
architectural gaps" section for why. This matters because they diff against different sources of
truth and produce subtly different results.

### The path the shipped UI actually uses: `export:generate-changelog` + `export:mrpack`

`ExportModal` calls these two channels directly; it never calls `export:run`.

**`export:generate-changelog`** — produces the editable changelog text shown before export:

1. **Auto-push** (0–20%) — if `mods/` exists, runs an inline copy of the push pipeline (steps
   1–11 above, same functions) so any un-pushed local mod changes are committed and pushed before
   diffing — otherwise the changelog would be comparing against a manifest that's already stale
   relative to what's about to be exported. Failure here aborts with `'Auto-push failed: <msg>'`.
2. **Pull latest** (22%) — `fetch` + `resetHard(origin/main)`, best-effort/non-fatal.
3. If no manifest exists at all yet → returns an "initial release" changelog (`type: 'initial'`).
4. **Fetch the published release from Modrinth** (35–42%) — looks up the modpack project
   (`modrinthProjectId` setting, default `O5wGsyGR`), finds the latest `status: 'listed'` version,
   downloads its `.mrpack`, and extracts `modrinth.index.json` from inside it via `AdmZip` — this
   becomes `prevFiles`, i.e. **the diff baseline is the live Modrinth-published release**, not a
   local snapshot. If that fetch fails for any reason, falls back to the newest
   `<versions-repo>/releases/v*.json` snapshot instead (flagged with a `warning` in the response).
   If neither source resolves, falls back further to an "initial release" changelog.
5. **Fast path** — if the current manifest's files are byte-identical (sorted `{path,sha512}`
   comparison) to `prevFiles`, returns `type: 'no_changes'` immediately.
6. **Diff mods** by identity (CDN projectId / slug fallback, same scheme as push) into
   `addedMods`/`removedMods`/`updatedMods`.
7. **Diff override files**, supplementally, against the nearest local snapshot's `overrideHashes`
   (sha256-based `addedFiles`/`removedFiles`/`changedFiles`).
8. Builds a markdown string (`## v<version> — <date>` + `### Added/Removed/Updated Mods` +
   `### Changed Files` sections) and returns it as `markdown`, editable by the user in
   `ExportModal` before the actual export.

**`export:mrpack`** — builds the actual `.mrpack` zip:

1. Requires a manifest to already exist (`'No manifest found. Push your changes first to generate
   one.'` if not).
2. If a `changelog` string was passed (i.e. this is a real release, not a draft), writes
   `releases/v<version>.json` (manifest snapshot + override hashes) and
   `releases/v<version>_changelog.md` to the versions repo and commits+pushes them (best-effort).
3. Builds the export manifest: sets `versionId` to the release version string, defaults
   `dependencies` from the `minecraftVersion`/`fabricLoaderVersion` settings if not already
   present, strips the internal `source` field from every file entry.
4. Zips directly with `AdmZip`: `modrinth.index.json` at the root; every `OVERRIDE_FOLDERS` file
   under `overrides/<folder>`; `INCLUDE_FILES`; and any
   `"source": "local"` mod, read from `<modpackRoot>/mods/<name>` (or
   `<versions-repo>/overrides/mods/<name>` as a fallback) and bundled into `overrides/mods/`.
5. Writes the zip to the chosen `outputPath`.

Returns `{ success: true, path, size }` or `{ success: false, error }`.

### The other path: `export:run` → `buildExport()` (`src/main/export/`)

A separate, cleanly-factored pipeline (`orchestrator.ts` → `modrinth.ts`, `changelog.ts`,
`packaging.ts`, `cache.ts`) that **no renderer component currently calls**. Documented here for
completeness/in case it's revived, but do not assume it's exercised by normal use of the app:

1. Detects Minecraft/Fabric-loader versions from `mmc-pack.json` under the profile root (not from
   `config.yaml` settings) via `detectVersions()`/`resolveLoaderVersion()`.
2. If `isRelease`, mutates a few files in place on the *live* profile root (not a staging copy):
   resets a FancyMenu "prompt for resource pack" flag, forces `guiScale: 0` in `options.txt`,
   updates `simpleupdatechecker_modpack.json`'s version fields.
3. Looks for a previous manifest at `<root>/manifests/modpack_manifest[_lite]_<olderVersion>.json`
   (`findPreviousManifest()`) — **a different location from `releases/*.json`** in the versions
   repo that the shipped flow uses.
4. Stages a temp directory, copies `include_folders`/`include_files` into it, resolves every mod
   jar's Modrinth metadata via a sha1-keyed cache at
   `<userData>/cache/.modpack_exporter_cache.json` (distinct from `.modrinth_cache.json` — see
   STORAGE_MODEL.md), bundles unresolved jars raw plus a generated `UNRESOLVED_MODS.txt`.
5. If `isRelease`, writes a changelog (diffed against the local `manifests/*.json` snapshot found
   in step 3, via `changelog.ts`'s `generateChangelog()`) and a new manifest snapshot back to
   `<root>/manifests/`.
6. Writes `modrinth.index.json` into the staging dir and zips it (`packageMrpack()`).

Returns an `ExportResult`. The `export:run` handler also writes `<modpackRoot>/.last_export_state.json`
and the `lastExportTime` setting on success — which means, since this path isn't currently
invoked by the UI, that file/setting likely never actually gets updated in practice (see
STORAGE_MODEL.md).

## Duplicate jar prevention

Two independent mechanisms guard against the same class of bug (a stale copy of a mod's jar
lingering alongside a freshly downloaded one under a different filename):

1. **`removeConflictingJars`** — used during pull's mod-sync step, before writing a new jar: removes
   both an exact filename match and any other jar sharing the same identity slug.
2. **The final duplicate sweep** — runs unconditionally at the end of every pull (both branches),
   grouping all jars currently in `mods/` by version-stripped slug and deleting every jar in a
   group that doesn't match the expected sha512, if one is known. This is the safety net that
   catches anything the per-entry logic above missed.

## Conflict handling summary

| Situation | Behavior |
|---|---|
| Local override file edited since last pull, and it also changed upstream | Local edit wins — upstream change is skipped, reported in `filesSkipped`. |
| Local mod added but not yet pushed, encountered during a pull | Preserved, reported in `preservedMods` — never deleted by the "remove stale mods" step. |
| Two jars on disk resolve to the same mod identity after a pull | Duplicate sweep deletes all but the one matching the expected hash. |
| Push attempted with `readOnlyMode` enabled | Rejected immediately, no changes made. |
| Push to a brand-new/empty remote (no upstream branch yet) | Detected via the push error message, retried once automatically. |
| `export:generate-changelog` can't reach Modrinth's API for the published release | Falls back to the newest local `releases/v*.json` snapshot, with a `warning` surfaced in the response. |
