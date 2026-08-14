# Storage Model

How the modpack's data is actually laid out on disk and in git. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the high-level hybrid-storage rationale and
[PUSH_PULL_FLOW.md](./PUSH_PULL_FLOW.md) for how these files get written/read during
push/pull/export.

There are **three separate locations** in play, easy to conflate:

1. **`<modpackRoot>`** — the user's real Modrinth-profile folder (`mods/`, `config/`,
   `resourcepacks/`, etc. — whatever they're actually playing with). Configured via the
   `modpackRoot` setting; falls back to `DEV_APP_ROOT` (a dev-only path) if unset.
2. **`<userData>/versions-repo`** — a local clone of `OR-Beyond/OR-Beyond-Versions`, entirely
   managed by the app. `<userData>` is Electron's `app.getPath('userData')`.
3. **`<userData>/production`** — a second, isolated copy of the profile used when "profile mode"
   is `prod` (see `profile:*` handlers) instead of `dev`. Push/pull/export all resolve which of
   `<modpackRoot>` or this production workspace to act on based on the current profile mode.

## `modrinth.index.json` (the manifest)

Lives at `<versions-repo>/modrinth.index.json`. This is Modrinth's own `.mrpack` manifest format.
Shape as written by `git:push` (`src/main/index.ts`):

```json
{
  "formatVersion": 1,
  "game": "minecraft",
  "versionId": "43",
  "name": "<pack name, basename of modpackRoot>",
  "dependencies": {
    "minecraft": "1.21.1",
    "fabric-loader": "0.16.9"
  },
  "files": [
    {
      "path": "mods/sodium.jar",
      "hashes": { "sha512": "<hex>" },
      "downloads": ["https://cdn.modrinth.com/data/{projectId}/versions/{versionId}/sodium.jar"],
      "fileSize": 123456
    },
    {
      "path": "mods/some-local-mod.jar",
      "hashes": { "sha512": "<hex>" },
      "downloads": [],
      "fileSize": 78901,
      "source": "local"
    }
  ]
}
```

- `versionId` is a simple incrementing integer (as a string), computed as
  `previousVersionId + 1` on every push — not a semver, not user-editable.
- `dependencies.minecraft` / `dependencies['fabric-loader']` come from the `minecraftVersion` /
  `fabricLoaderVersion` settings (defaults `1.21.1` / `0.16.9`).
- Every entry with a real `downloads[0]` URL is a Modrinth-hosted mod — the jar itself is never
  committed, just referenced. It's re-downloaded on pull from the Modrinth CDN.
- Entries with `"source": "local"` and empty `downloads` are mods not found on Modrinth by hash —
  their actual `.jar` bytes are committed to `overrides/mods/<filename>` instead (see below), and
  this manifest entry just records their hash/size for change detection.
- `files` is rebuilt **entirely** from the current local `mods/` scan on every push — it is
  deliberately never merged with the previous manifest, so a mod deleted locally truly disappears
  from the manifest rather than reappearing on a future pull.
- Validated on both push and pull by `validateManifest()` (`src/main/versions.ts`): `files` must
  be an array, each entry needs a string `path` and non-empty `hashes`, optional `downloads` must
  be `string[]`, optional `versionId` must be numeric.

Identity across pushes/pulls (used for diffing "added/updated/removed") is **not** the file
`path` — it's derived per-entry: the Modrinth `projectId` parsed out of the CDN download URL
(`https://cdn.modrinth.com/data/{projectId}/versions/{versionId}/{filename}`), falling back to
the jar's basename (minus `.jar`) for local/unresolved mods. This is the same identity scheme
`git:pull`, `git:push`, and `git:push-preview` all use, so a mod that's locally renamed but is
still the same Modrinth project isn't treated as "removed + added."

## `overrides/` (the versions-repo folder)

Everything under here is synced as literal files through git — no manifest indirection. Folders
synced (the `OVERRIDE_FOLDERS` constant in `index.ts`):

```
overrides/
  config/
  resourcepacks/
  shaderpacks/
  essential/            (partially — see exclusions below)
  fancymenu_data/
  data/
  keybind_presets/
  configureddefaults/
  mods/                 (only "source: local" jars land here — see above)
```

Plus two root-level files synced individually (`INCLUDE_FILES`): `checkbox_states.json`,
`emi.json`.

Sync algorithm (`syncOverridesToRepo`, used by `git:push` and `export:generate-changelog`'s
auto-push step): for each folder, deletes stale/excluded files at the destination, then copies
everything from `<modpackRoot>/<folder>` to `<versions-repo>/overrides/<folder>` (skipping
excluded paths — see below). A push-time sweep also deletes anything under `overrides/` outside
this defined scope (excluding `overrides/mods/`, which is cleaned up separately in the mod-scan
step) if the corresponding local file no longer exists.

### Exclusions

- **`ESSENTIAL_EXCLUDE`** — never synced from `essential/`, even though the folder itself is in
  scope: `cache`, `cosmetic-cache`, `image-cache`, `screenshot-cache`, `screenshot-metadata`,
  `screenshot-checksum-caches.json`, `libraries`, `loader`, `lwjgl3-natives`, `version.json`.
  These are caches/binaries/machine state, not modpack content. Also, any `.jar`/`.meta` file
  under `essential/` is skipped regardless of path (`shouldSkipEssentialFile`).
- **Personal files** — `options.txt`, `keybindings.txt`, `servers.dat`, and anything not under an
  `OVERRIDE_FOLDERS` folder or `INCLUDE_FILES` list are never touched by sync at all; they simply
  aren't in scope.

## `.last_pull_state.json` (gitignored, in `<versions-repo>`)

```ts
interface PullState {
  files: Record<string, string>; // "<folder>/<relative path>" → sha256 hex
}
```

Written by `savePullState()` at the end of every successful `git:pull`; read by `loadPullState()`
at the start of the next pull. Purpose: distinguish "this override file changed upstream" from
"the user edited this file locally since their last pull" so pull never silently clobbers local
edits. During the smart-merge branch of pull, for each override file the three-way comparison is:

- remote hash == last-pull hash → nothing changed upstream, leave local file alone.
- local hash == last-pull hash **and** remote hash differs → safe to overwrite (user hasn't
  touched it), copy the new version in.
- local hash differs from last-pull hash → the user edited it locally; **skip** it and report it
  in `filesSkipped` rather than overwriting their work.
- no last-pull hash recorded at all (a file the user added locally that was never part of a pull)
  → also skipped, reported in `filesSkipped`.

Not present at all on a fresh clone — combined with an empty `mods/` folder, that's exactly the
condition (`isFirstPull`) that triggers the clean-install branch of pull instead of smart-merge
(see PUSH_PULL_FLOW.md).

## `.modrinth_cache.json` (gitignored, in `<versions-repo>`)

```ts
interface ModrinthLookupResult {
  found: boolean;
  slug?: string;
  title?: string;
  iconUrl?: string;
  downloadUrl?: string;
  fileSize?: number;
  filename: string;
}
```

Keyed by the jar's **sha512** hash. Populated by `lookupModrinthHash()` and consumed by
`git:push`, `git:pull` (identity/display lookups), `git:push-preview`, `git:commit-changes`, and
`export:generate-changelog`'s auto-push step. Both hits **and misses** (`found: false`) are
cached, so a jar Modrinth doesn't recognize isn't re-queried on every push. `ensureGitignore()`
makes sure both this file and `.last_pull_state.json` stay out of git (appends them to
`<versions-repo>/.gitignore` if missing).

**This is a different cache from `src/main/export/cache.ts`'s `ModrinthCache`**, which lives at
`<userData>/cache/.modpack_exporter_cache.json`, is keyed by **sha1** (not sha512), stores a
differently-shaped `ModrinthMeta` record, and is only ever touched by the `export/` module's
`resolveModMetadata()` — which itself is only reachable through the `export:run` channel that the
shipped UI doesn't call (see ARCHITECTURE.md). In practice, the cache that matters for the real
push/pull/changelog flow is `.modrinth_cache.json` in the versions repo, not this one.

## `.version_history.json` (in `<versions-repo>`)

```ts
interface VersionRecord {
  id: string;
  manifestVersion: string;
  timestamp: string;
  message: string;
  author: string;
  commitSha: string;
}
```

Read by `loadVersionHistory()`, backing the `versions:list` / `versions:current` /
`versions:rollback` IPC channels and the `VersionHistoryModal` UI. **Nothing in the codebase
currently writes to it** — `appendVersionRecord()` (`src/main/versions.ts`) is imported into
`index.ts` but has no call site, and `clearVersionHistory()` has no call site either. Unless this
file was seeded manually or by a previous version of the app, version history will read back
empty. Worth fixing or removing before relying on this feature.

## `<userData>/cache/mod-icons/<slug>.png`

Disk cache for mod icons fetched from the Modrinth API, used by the `modrinth:get-icons` handler.
Each file is the raw icon bytes (converted to a `data:` URI when returned over IPC) — a simple
permanent cache, never invalidated.

## `releases/` (in `<versions-repo>`)

Written by `export:mrpack` whenever it's called with a `changelog` argument (i.e. a real
release export, not a draft). Two files per version, only created if they don't already exist
(or if `overwriteSnapshot` is passed):

- **`releases/v<version>.json`**:
  ```json
  {
    "version": "1.4.0",
    "exportedAt": "<ISO timestamp>",
    "manifest": { "...modrinth.index.json shape, files without their `source` field..." },
    "overrideHashes": { "<relative path under overrides/>": "<sha256>", "..." }
  }
  ```
- **`releases/v<version>_changelog.md`** — the raw changelog markdown text passed in from the
  export UI (user-editable before export, see `ExportModal`).

Both are committed and pushed to the versions repo (best-effort — failure here doesn't fail the
export, just logs a warning). This snapshot is what `export:generate-changelog` falls back to
diffing against on a later export if it can't fetch the live Modrinth-published `.mrpack` (e.g.
network failure, or the very first release before anything's published).

**Do not confuse this with `<modpackRoot>/manifests/`** (a completely different, unrelated
snapshot location used only by the mostly-unused `src/main/export/changelog.ts`
`findPreviousManifest()`/`generateChangelog()` functions and by `src/main/sync-mods/index.ts`'s
`findLatestManifest()` — neither of which is on the path the shipped export UI actually exercises;
see ARCHITECTURE.md).

## `<modpackRoot>/.last_export_state.json`

```json
{ "version": "1.4.0", "timestamp": "<ISO timestamp>" }
```

Written only by the `export:run` handler (which calls `buildExport()` in `src/main/export/`), and
read by `config:read-export-state` / `modpack:info`. **`export:run` does not appear to be called
from any current renderer component** — `ExportModal` drives exports via `export:generate-changelog`
+ `export:mrpack` instead, neither of which touches this file or the `lastExportTime` setting. In
the app's actual shipped flow, this file and the "last export" timestamp shown in the sidebar may
simply never update — worth confirming against real usage before treating it as reliable.

## `<versions-repo>/.gitignore`

Maintained by `ensureGitignore()`: guaranteed to contain `.modrinth_cache.json` and
`.last_pull_state.json` (appended if missing, never overwritten otherwise).

## Profile snapshots (`<userData>/profile-snapshots/` or similar, via `profile.ts`)

Each snapshot (`profile:snapshot` / `takeSnapshot()`) is a recursive sha256 hash of every file
under a profile root (`<modpackRoot>` in dev mode, `<userData>/production` in prod mode), saved
as its own `snap-<timestamp>.json` file, plus a lightweight summary appended to an `index.json`
(what `profile:list-snapshots` reads — hashes stripped for the list view). Snapshots are taken
automatically before every push and pull, and manually via the Settings page.

**Snapshots currently only store hashes, not content.** `restoreSnapshot()` can tell you which
files drifted from a snapshot, but its restore path looks for a `fileContents` field that
`takeSnapshot()` never populates — so `profile:restore` can detect but not actually undo file
changes right now.

## Config file: `<modpackRoot>/config.yaml` (or packaged `resourcesPath/config.yaml` in dev)

YAML, read/written via `js-yaml`. Drives export behavior and repo/Modrinth identity. Fields used
across the codebase (see `AppConfig` in `src/renderer/lib/types/index.ts` for the renderer-side
shape, which matches):

```yaml
pack_name: ...
version: ...
minecraft_version: ...
fabric_loader_version: ...
lite_pack_name: ...
lite_version: ...
github_repo: https://github.com/OR-Beyond/OR-Beyond-Versions
github_branch: main
modrinth_id: ...
modrinth_url: ...
lite_modrinth_id: ...
lite_modrinth_url: ...
include_folders: [config, resourcepacks, ...]
include_files: [...]
# plus export-only fields read directly by buildExport(): lite_whitelist.mods,
# lite_whitelist.resource_packs, exclude_subfolders
```

`github_repo`/`github_branch` here is what the activity feed (`App.tsx`'s `loadCommits`) uses to
know which repo/branch to list commits from via the GitHub API — it should point at
`OR-Beyond/OR-Beyond-Versions`, not this app's own repo.

## First-pull vs. subsequent pulls

A pull is treated as a **first pull (clean install)** only when *both* are true: no
`.last_pull_state.json` exists yet, and `<modpackRoot>/mods/` currently has zero `.jar` files.
Requiring both guards against wiping an already-populated install whose state file was merely
lost (e.g. deleted, or a fresh app install pointed at an existing profile) — that scenario instead
falls through to the smart-merge branch. See PUSH_PULL_FLOW.md for exactly what each branch does.
