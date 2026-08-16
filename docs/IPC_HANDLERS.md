# IPC Handlers

Every IPC channel the app exposes: name, direction, payload, return shape, where it's
registered, and where it's called from. All handlers are registered via `ipcMain.handle` inside
`registerIpc()` in `src/main/index.ts` (called once from `app.on('ready', ...)`). There are no
`ipcMain.on(...)` (fire-and-forget) channels — everything is request/response via `invoke`,
except the five event channels listed at the end, which are one-way main → renderer pushes.

The renderer never calls `ipcRenderer` directly. It always goes through the typed
`window.electron.*` wrapper defined in `src/preload/preload.ts` and typed again in
`src/renderer/lib/types/index.ts` (`declare global { interface Window { electron: {...} } }`) —
that second file is the authoritative typed contract renderer code programs against. Below,
"Preload method" is the `window.electron.*` call renderer code actually makes.

For the full step-by-step algorithm behind `git:push`, `git:pull`, `git:undo-last-push`,
`export:generate-changelog`, and `export:mrpack`, see [PUSH_PULL_FLOW.md](./PUSH_PULL_FLOW.md) —
this document gives the channel contract, not the internal steps.

### Error message policy

Every handler that touches the filesystem, the versions repo, or GitHub translates exceptions
into a human-readable `error` string before returning `{ success: false, ... }` — never a raw
stack/`message`. Main-process helpers:

- `describeFileError(e, fallback)` (`src/main/index.ts`) — maps Node `fs`/`path` error codes
  (`ENOENT`, `EACCES`/`EPERM`, `EISDIR`, `ENOTDIR`, `ENOSPC`, `EBUSY`, `EEXIST`, `EROFS`,
  `ENAMETOOLONG`, `EMFILE`, `ENOTEMPTY`) and common `isomorphic-git` messages (no upstream,
  fetch-first/non-fast-forward/rejected, auth/401/403/login/token) to plain-language text.
  Unmapped errors fall back to `fallback` (keeping the raw message only as a last resort).
- `describeGitHubError(e)` (`src/main/index.ts`) — flags GitHub API rate limits
  ("try again in a few minutes") and 401s ("sign out and sign in again"), otherwise falls back
  to `e.message`.
- Non-fatal side steps (e.g. snapshot git push inside `export:mrpack`, per-file hashing in
  `export:generate-changelog`) log via `console.warn` with the file path and skip that item
  instead of failing the whole operation.

Network-only helpers (`settings:test-webhook`, `export:latest-modrinth-version`) return their own
fixed, user-friendly strings for fetch failures.

## Progress / event channels (main → renderer)

These are pushed via `mainWindow?.webContents.send(...)` (or `event.sender.send(...)` for the
device-code one) and consumed via `on`/`off` pairs in `window.electron.*`. Handlers register a
single listener at a time (a new `on*` call replaces the previous one).

| Channel | Payload | Fired by | Preload `on`/`off` |
|---|---|---|---|
| `sync:progress` | `{ stage: string, message: string, percent: number }` | `git:pull`, `git:push`, `git:undo-last-push` | `git.onSyncProgress(handler)` / `git.offSyncProgress()` |
| `export:progress` | `{ stage: string, message: string, percent: number }` | `export:generate-changelog`, `export:mrpack` | `export.onProgress(handler)` / `export.offProgress()` |
| `modpack:scan-progress` | `{ message: string }` | throttled (≤2/sec) during `modpack:deep-scan` and the startup background scan | `modpack.onScanProgress(handler)` / `modpack.offScanProgress()` |
| `modpack:root-found` | `{ path: string }` | the startup background deep scan (`runStartupScan()`), when it finds a modpack root the user never configured | `modpack.onRootFound(handler)` / `modpack.offRootFound()` |
| `device-auth:code` | `DeviceCodeInfo` = `{ user_code, verification_uri, expires_in }` | `device-auth:start` handler, once GitHub returns the device code | `auth.onDeviceCode(handler)` / `auth.offDeviceCode()` |

## App / window (`app:*`)

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `app:minimize` | `app.minimize()` | — | `void` |
| `app:maximize` | `app.maximize()` | — | `void` (toggles maximize/unmaximize) |
| `app:close` | `app.close()` | — | `void` |
| `app:check-for-update` | `app.checkForUpdate()` | — | `UpdateCheckResult = { updateAvailable, version?, downloadUrl?, releaseNotes? }` |
| `app:install-update` | `app.installUpdate(downloadUrl?)` | `downloadUrl?: string` (accepted, unused inside — always uses `electron-updater`'s already-downloaded update or triggers a fresh download) | `void` |
| `app:open-external` | `app.openExternal(url)` | `url: string` | `Promise<void>` (via `shell.openExternal`) |
| `app:select-directory` | `app.selectDirectory()` | — | `string \| null` (chosen path, or `null` if canceled) |
| `app:show-in-folder` | `app.showInFolder(filePath)` | `filePath: string` | `void` |
| `app:platform` | *(also exposed directly as `window.electron.platform`, not a function)* | — | `string` (`process.platform`) |

Called from: `WindowControls.tsx` (minimize/close), `Header/index.tsx` (openExternal for user
profile), `Sidebar/index.tsx` (openExternal for issue links), `SettingsModal`/`SettingsPage`
(selectDirectory), `ExportModal` (showInFolder), `App.tsx` (checkForUpdate/installUpdate — via
the update-check flow, `openExternal` for "report a bug").

## Device-flow auth (`device-auth:*`)

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `device-auth:start` | `auth.start()` | — | `{ success: true, token, user: GitHubUser \| null } \| { success: false, error }` |
| `device-auth:logout` | `auth.logout()` | — | `{ success: true } \| { success: false, error }` |
| `device-auth:check` | `auth.check()` | — | `{ success: true, authenticated, user? } \| { success: false, authenticated: false, error }` |

`device-auth:start` drives GitHub's OAuth device flow (see `src/main/githubAuth.ts`,
`startDeviceAuth`): it pushes the `device-auth:code` event as soon as GitHub returns the code,
then polls until the user approves, times out, or is denied, and resolves with the outcome.

Called from: `LoginModal/index.tsx` (`start`, `onDeviceCode`/`offDeviceCode`, `logout` on
cancel), `App.tsx` (`check` on boot via `checkAuth()`, `logout` on sign-out).

## Settings (`settings:*`)

Backed by `electron-store` (`src/main/store.ts`) — see STORAGE_MODEL.md / ARCHITECTURE.md for the
full schema.

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `settings:get` | `settings.get(key)` | `key: keyof StoreSchema` | `store.get(key) \|\| null` |
| `settings:set` | `settings.set(key, val)` | `key: keyof StoreSchema, val: string` | `void`-ish (whatever `store.set` returns) |
| `settings:get-all` | `settings.getAll()` | — | the whole `StoreSchema` object (`store.store`) |
| `settings:test-webhook` | `settings.testWebhook(url)` | `{ url: string }` | `{ success: true } \| { success: false, error }` — POSTs a test embed to the given Discord webhook URL |
| `settings:get-read-only` | `settings.getReadOnly()` | — | `boolean` |
| `settings:set-read-only` | `settings.setReadOnly(enabled)` | `{ enabled: boolean }` | `void` |
| `settings:get-auto-sync` | `settings.getAutoSyncOnLaunch()` | — | `boolean` |
| `settings:set-auto-sync` | `settings.setAutoSyncOnLaunch(enabled)` | `{ enabled: boolean }` | `void` |

Called from: `settingsCache.ts` (`initSettingsCache`/`getCachedSetting`/`setCachedSetting` wrap
`get`/`set`/`getAll` for synchronous-feeling reads), `SettingsPage/index.tsx` and
`SettingsModal/index.tsx` (read-only + auto-sync toggles, webhook test), `App.tsx` (various
one-off reads like `modrinthProjectId`, `modpackRoot`, `initialSetupComplete`,
`lastExportTime`).

## Config (`config:*`)

Reads/writes the modpack's `config.yaml` (see STORAGE_MODEL.md).

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `config:read` | `config.read()` | — | `{ success: true, data: AppConfig } \| { success: false, error }` |
| `config:write` | `config.write(data)` | `data: Record<string, unknown>` | `{ success: true } \| { success: false, error }` |
| `config:read-export-state` | `config.readExportState()` | — | `{ success: true, data: {version,timestamp} \| null } \| { success: false, error }` — reads `<root>/.last_export_state.json` |

Called from: `App.tsx` (`loadConfig`, `loadExportState`, and after export/settings save),
`SettingsPage`/`ExportModal` indirectly via the version/config fields they display.

## GitHub (`github:*`)

Requires an authenticated Octokit client (`getOctokit()` in `githubAuth.ts`); returns
`{ success: false, error: 'No token' }` if not signed in.

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `github:get-user` | `github.getUser()` | — | `{ success: true, data } \| { success: false, error }` — `oc.users.getAuthenticated()` |
| `github:get-commits` | `github.getCommits({owner,repo,branch})` | `{ owner: string, repo: string, branch: string }` | `{ success: true, data } \| { success: false, error }` — `oc.repos.listCommits({sha: branch, per_page: 20})` |
| `github:get-commit-files` | `github.getCommitFiles({owner,repo,sha})` | `{ owner: string, repo: string, sha: string }` | `{ success: true, data: { files, modChanges, configChanged } } \| { success: false, error }` |
| `github:get-issues` | `github.getIssues({owner,repo})` | `{ owner: string, repo: string }` | `{ success: true, data: Issue[] } \| { success: false, error }` — open issues only, PRs filtered out, `per_page: 20` |

`github:get-commit-files` also detects if `config.yaml` changed and, for changed
`manifests/*.json` files, diffs old vs new manifest content (`diffManifests`) into `ModChange[]`.

Called from: `App.tsx` (`loadCommits`, `loadIssues`, `enrichCommitDetails` — the last one is the
primary caller of `getCommitFiles`, used as a fallback when `git:commit-changes` doesn't have
richer local data).

## Git operations (`git:*`)

The core sync engine. All git access goes through the single `gitProvider`
(`IsomorphicGitProvider`) instance built once at module load. See PUSH_PULL_FLOW.md for the full
algorithms behind `git:pull`, `git:push`, and `git:undo-last-push`.

| Channel | Preload method | Payload | Returns (success shape) | Returns (failure shape) |
|---|---|---|---|---|
| `git:ensure-versions-repo` | `git.ensureVersionsRepo()` | — | `{ success: true }` | `{ success: false, error }` |
| `git:pull` | `git.pull()` | — | `{ success: true, pulled: true, modsDownloaded, modsRemoved, modsSkipped, filesUpdated, filesSkipped, errors, addedMods, updatedMods, removedMods, preservedMods, changedFiles }` | `{ success: false, error }` |
| `git:push` | `git.push({message})` | `{ message: string }` | `{ success: true, version, modsAdded, modsRemoved, removedMods, modsUnresolved, filesChanged, commit: PushedCommit \| undefined }` | `{ success: false, error }` |
| `git:status` | `git.status()` | — | `{ success: true, data: { branch, ahead, behind, modified: string[], lastPull } }` | `{ success: false, error }` |
| `git:staged-files` | `git.stagedFiles()` | — | `{ success: true, data: string[] }` | — |
| `git:commit-changes` | `git.commitChanges(sha)` | `sha: string` | `{ success: true, data: { mods: CommitModEntry[], otherFiles: CommitFileEntry[] } }` | `{ success: false, error, data: {mods:[], otherFiles:[]} }` |
| `git:push-preview` | `git.pushPreview()` | — | `{ success: true, addedMods, updatedMods, removedMods, changedFiles, unchangedCount, isFirstPush }` | `{ success: false, error, addedMods:[], updatedMods:[], removedMods:[], changedFiles:[], unchangedCount:0 }` |
| `git:undo-last-push` | `git.undoLastPush()` | — | `{ success: true, message }` | `{ success: false, error }` |

`git:pull` and `git:push` both:
- refuse to run if `readOnlyMode` is enabled (`{ success: false, error: 'Cannot ... while
  read-only mode is enabled. Disable it in Settings first.' }`),
- refuse to run if no `modpackRoot` is configured,
- take a profile snapshot (`takeSnapshot`) before touching anything,
- stream `sync:progress` events throughout.

`PushedCommit` (the `commit` field on a successful `git:push`) = `{ sha, message, author: {name,
email}, timestamp }` — added specifically so the renderer's activity feed can show the just-
pushed commit immediately instead of waiting on a GitHub API refetch (see
`App.tsx`'s `handlePushSuccess`).

Called from: `App.tsx` (`pull`, `undoLastPush`, `status`, `ensureVersionsRepo` during first-run
setup and auto-sync-on-launch), `PushModal/index.tsx` (`pushPreview` on mount, `push` on
confirm), `ActivityFeed/ActivityCard.tsx` (`commitChanges` per commit card, falling back to
`github.getCommitFiles`), `VersionHistoryModal` (indirectly via `versions:*`, not `git:*`
directly).

## Export (`export:*`)

See ARCHITECTURE.md's "notable gaps" section and PUSH_PULL_FLOW.md for which of these actually
call into `src/main/export/` vs. reimplement their own logic in `index.ts`.

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `export:run` | `export.run(o)` | `ExportOptions = { version, isLite, isRelease, packName, exportDir? }` | Whatever `buildExport()` returns (`ExportResult`), or `{ success:false, error }` |
| `export:latest-modrinth-version` | `export.latestModrinthVersion(projectId)` | `projectId: string` | `{ version_number, versionId, publishedAt } \| { version_number: null, reason: string }` |
| `export:manifest-version` | `export.manifestVersion()` | — | `{ success: true, versionId: number \| null } \| { success: false, versionId: null, error }` |
| `export:save-dialog` | `export.saveDialog({defaultPath})` | `{ defaultPath?: string }` | `string \| null` (chosen file path) |
| `export:generate-changelog` | `export.generateChangelog({version})` | `{ version: string }` | `{ success: true, type: 'initial'\|'diff'\|'no_changes', snapshotExists, diff, markdown, warning?, note? } \| { success: false, error }` |
| `export:mrpack` | `export.mrpack({outputPath, version, changelog?, overwriteSnapshot?, includeFancyMenu?, includeDefaultOptions?})` | `{ outputPath: string, version: string, changelog?: string, overwriteSnapshot?: boolean, includeFancyMenu?: boolean, includeDefaultOptions?: boolean }` | `{ success: true, path, size, published?, publishedVersionId? } \| { success: false, error }` |

`export:generate-changelog` and `export:mrpack` both stream `export:progress` events.
`export:generate-changelog` also performs an **auto-push** of any local mod changes as its first
step (see PUSH_PULL_FLOW.md) — it can fail with `{ success: false, error: 'Auto-push failed:
<msg>' }` before it even gets to diffing.

Called from: `ExportModal/index.tsx` (the entire export wizard: `latestModrinthVersion`,
`manifestVersion`, `saveDialog`, `onProgress`/`offProgress`, `generateChangelog`, `mrpack`),
`App.tsx` (`manifestVersion`, `latestModrinthVersion` for the dashboard header). `export:run` is
not currently called from any renderer component that was found — the wired-up export UI
(`ExportModal`) uses `generateChangelog` + `mrpack` directly, not `export:run`/`buildExport`.

## Modpack root detection (`modpack:*`)

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `modpack:detect-root` | `modpack.detectRoot()` | — | `{ success: true, path: string \| null }` — fast, shallow scan of known launcher paths |
| `modpack:deep-scan` | `modpack.deepScan()` | — | `{ success: true, path, driveRoot } \| { success: false, path: null, driveRoot: null, error }` — full drive scan, single-flight guarded, fires `modpack:scan-progress` |
| `modpack:abort-scan` | `modpack.abortScan()` | — | `{ success: true }` |
| `modpack:list-profiles` | `modpack.listProfiles()` | — | `{ success: true, data: LauncherProfileGroup[] } \| { success: false, data: [], error }` |
| `modpack:set-root-from-profile` | `modpack.setRootFromProfile(path)` | `path: string` (raw, not wrapped in an object) | `{ success: true }` |
| `modpack:set-root` | `modpack.setRoot(p)` | `p: string` (raw) | `{ success: true }` |
| `modpack:get-root` | `modpack.getRoot()` | — | `{ success: true, path: string \| null }` |
| `modpack:info` | `modpack.info()` | — | `{ success: true, data: { config, exportState } } \| { success: false, error }` |

`modpack:list-profiles` scans Modrinth, Prism, MultiMC, ATLauncher, CurseForge, and GDLauncher
install locations (including portable installs found via a drive-wide scan) for valid modded
profiles.

Called from: `SettingsModal/ProfileSelector.tsx` / `SettingsModal/SettingsPage`'s embedded
`ProfileSelector` (`listProfiles`, `setRootFromProfile`, `onRootFound`/`offRootFound`,
`onScanProgress`/`offScanProgress`), `App.tsx` (`modpackRoot` setting read directly rather than
via these channels in most places — see `settings:get`).

## Version history (`versions:*`)

Distinct from the versions-repo *content* history — this is the app's own record of push
versions, stored in `.version_history.json` in the versions-repo dir (see `src/main/versions.ts`
and STORAGE_MODEL.md).

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `versions:list` | `versions.list()` | — | `{ success: true, data: VersionRecord[] } \| { success: false, error }` |
| `versions:rollback` | `versions.rollback(versionId)` | `{ versionId: string }` | `{ success: true, message } \| { success: false, error }` |
| `versions:current` | `versions.current()` | — | `{ success: true, manifestVersion: string \| null } \| { success: false, error }` |

`versions:rollback` finds the target version's commit sha, diffs it against `HEAD`, restores each
changed file's blob from that commit (or deletes it if it didn't exist there), commits, pushes,
then re-syncs local state (`fetch` + `resetHard(origin/main)`).

Called from: `VersionHistoryModal/index.tsx` (`list` on mount, `rollback` on confirm — uses a
native `window.confirm()`, not `ConfirmDialog`).

## Profile protection (`profile:*`)

"Profile mode" (`dev`/`prod`) and snapshot/restore/promote — see `src/main/profile.ts` and
ARCHITECTURE.md's note on `restoreSnapshot`'s current limitation (hash-only, can't restore bytes).

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `profile:get-mode` | `profile.getMode()` | — | `ProfileMode` (`'dev'\|'prod'`, raw, unwrapped) |
| `profile:set-mode` | `profile.setMode(mode)` | `{ mode: string }` | `void` |
| `profile:snapshot` | `profile.snapshot()` | — | `{ success: true, data: SnapshotRecord } \| { success: false, error }` |
| `profile:list-snapshots` | `profile.listSnapshots()` | — | `{ success: true, data: SnapshotRecord[] } \| { success: false, error }` |
| `profile:restore` | `profile.restore(snapshotId)` | `{ snapshotId: string }` | `{ success: boolean, error? }` (whatever `restoreSnapshot()` returns directly) |
| `profile:promote` | `profile.promote()` | — | `{ success: boolean, copiedMods?, copiedFiles?, error? }` (whatever `promoteToProduction()` returns directly) |
| `profile:promote-preview` | `profile.promotePreview()` | — | `{ success: true, data: PromoteDiffEntry[] }` — diffs dev root vs. the prod workspace |

Called from: `SettingsPage/index.tsx` (all of these — snapshot/restore/promote UI + preview
diff), `App.tsx` (`getMode`, `listSnapshots`, `promote`, `snapshot` for the sidebar's profile
protection card).

## Modrinth icon cache (`modrinth:*`)

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `modrinth:get-icons` | `modrinth.getIcons(slugs)` | `slugs: string[]` (raw array) | `Record<slug, string \| null>` — `data:image/png;base64,...` URIs, disk-cached under `<userData>/cache/mod-icons/<slug>.png`; no success/error wrapper |

Called from: `ActivityFeed/ActivityCard.tsx` (mod icons on commit cards).

## Default Options (`defaults:*`)

Curated Default Options files (Twelve Iterations mod) — see STORAGE_MODEL.md's `defaults/`
section for the full data-flow contract. Files live in `<versions-repo>/defaults/` and are the
only source for `overrides/config/defaultoptions/` in exported `.mrpack` files.

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `defaults:get-state` | `defaults.getState()` | — | `DefaultOptionsState` — `Record<'options'\|'keybindings'\|'servers', { exists: boolean, localExists: boolean, size?, modified?, localSize?, localModified?, sha256?, localSha256? }>` (raw, no success/error wrapper) |
| `defaults:import` | `defaults.import(fileType)` | `{ fileType: 'options'\|'keybindings'\|'servers' }` | `{ success: true, fileName, size } \| { success: false, error }` |

`defaults:import` reads `<modpackRoot>/config/defaultoptions/<file>`, ensures the versions repo
is up to date (`ensureVersionsRepo`), copies the file into `<versions-repo>/defaults/`, and
commits + pushes it. The local source file is deleted **only after** commit + push succeed; if
the push fails, nothing is deleted and the error is returned. If the source file is missing it
returns an error telling the user to run `/defaultoptions saveAll` in a singleplayer world first.

Called from: `SettingsPage/index.tsx` (the "Default Options" card in the Modpack category —
loads state on mount via `getState`, imports per-file via `import`).

## Legacy sync bridge (`python:*`)

| Channel | Preload method | Payload | Returns |
|---|---|---|---|
| `python:sync-mods` | `python.syncMods()` | — | `{ success: true, data: SyncResult } \| { success: false, error }` |

Despite the `python:` channel prefix (a naming holdover), this calls `syncMods()` in
`src/main/sync-mods/index.ts` — a pure TypeScript, manifest-file-driven mod reconciler, separate
from the git-based push/pull flow (see ARCHITECTURE.md). Not currently called from any renderer
component that was found in this pass — likely a manual/dev-only entry point.
