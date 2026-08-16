# UI Components

The renderer is plain React 18 — no Redux/Zustand/Context providers for app state. Everything
lives in `App.tsx`'s hooks and is passed down as props; the closest thing to global state outside
that is `src/renderer/lib/utils/settingsCache.ts` (a simple write-through cache over the
`settings:*` IPC channel, letting components read settings synchronously without an `await`) and
`src/renderer/lib/utils/logger.ts` (a `console.*`-interception ring buffer feeding the in-app Logs
page, unrelated to app/business state).

Every component talks to the main process exclusively through `window.electron.*` — see
[IPC_HANDLERS.md](./IPC_HANDLERS.md) for the channel each call maps to.

## `App.tsx` — root component and state owner

### State

| State | Purpose |
|---|---|
| `page: 'home'\|'settings'\|'logs'` | Top-level page routing (no router library — just a switch on this). |
| `authState: 'loading'\|'unauthenticated'\|'authenticated'` | Drives which of three top-level renders happens (splash / sign-in screen / dashboard). |
| `user: GitHubUser \| null` | Signed-in user (login/avatar/html_url) shown in `Header`. |
| `config: AppConfig \| null` | Parsed `config.yaml`. |
| `modpackRootSet: boolean` | Whether `modpackRoot` is configured — drives the "⚙ Set modpack root in Settings" nudge button. |
| `commits: CommitCard[]` | Activity feed data. |
| `issues: Issue[]` | Open GitHub issues, shown in `Sidebar`. |
| `syncStatus: SyncStatus` | Branch/ahead/behind/modified/lastPull, from `git:status`. |
| `lastExportTime: string \| null` | Shown in `Sidebar` (see STORAGE_MODEL.md's caveat — may not update in practice). |
| `isLoadingCommits`, `manifestVersion`, `modrinthRelease` | Dashboard header/loading state. |
| `showPush`, `showExport`, `showSettings`, `showLogin`, `showPromoteConfirm`, `showVersionHistory` | Modal visibility flags. |
| `pullResult: PullResult \| null` | Drives `PullResultPopup`; set after manual pull, auto-sync-on-launch, or first-run setup. |
| `isAutoSyncing: boolean` | Small "Syncing…" pill shown bottom-right during launch auto-sync. |
| `initState`, `initProgress`, `initError`, `initInFlightRef` | First-run initialization (clone + full pull) phase tracking. |
| `profileMode: 'dev'\|'prod'`, `lastSnapshotTime` | Profile-protection status for `Sidebar`. |
| `isUndoingLastPush` | Button loading state. |
| `lastCommitShaRef` (ref) | Newest known commit sha — lets focus-refresh do an incremental `since`-based fetch instead of a full reload, and lets the optimistic post-push commit card get reconciled correctly. |

### Key effects/flows

- **Boot** (`useEffect` on mount) — `initSettingsCache()` → `checkAuth()` → if authenticated,
  `loadDashboard()`.
- **`loadDashboard()`** — loads config/export state, kicks off (in parallel) manifest version,
  latest Modrinth release, commits, issues, and git status; then resolves profile mode + last
  snapshot; if `modpackRoot` isn't set, prompts Settings and stops; if first-run
  (`initialSetupComplete !== 'true'`), starts `runInitialSetup()`; otherwise, if
  `autoSyncOnLaunch` is enabled, does a silent background pull (with one retry on a detected
  `index.lock`).
- **`runInitialSetup()`** — clones the versions repo, then does a full pull, marking
  `initialSetupComplete` only once *both* succeed (idempotent — a quit mid-pull just retries next
  launch). Drives `InitialSetupScreen` while active.
- **Window-focus auto-refresh** — debounced to once per 30s; does an incremental commits fetch
  (`loadCommits(config, lastCommitShaRef.current)`), plus a full git-status and issues refresh.
- **`handlePushSuccess(commit?)`** — the most involved handler: if `commit` details came back from
  `git:push` (sha/message/author/timestamp), builds an optimistic `CommitCard` and prepends it to
  the feed *immediately*, before any GitHub API call — because GitHub's commits API can lag a
  moment behind a commit that was just pushed. It then reconciles with a real `loadCommits(config)`
  fetch ~500ms later, and if that fetch still doesn't include the pushed sha (API not caught up
  yet), re-adds the optimistic card rather than letting it silently disappear.
- **`handlePull`, `handleUndoLastPush`, `handleExportSuccess`, `handleSettingsSaved`,
  `handleConfirmPromote`, `handleTakeSnapshot`, `handleLoginSuccess`, `handleLogout`** — thin
  wrappers around the corresponding IPC calls + toast feedback + refreshing the relevant dashboard
  state afterward.

### Render structure

```
authState === 'loading'   → splash screen
authState === 'unauthenticated' → sign-in screen (+ LoginModal if opened)
authState === 'authenticated' →
  Header
  page === 'home':
    initActive (cloning/pulling/error) → InitialSetupScreen
    else → ActivityFeed + Sidebar (side by side)
  page === 'settings' → SettingsPage
  page === 'logs' → LogsPage
  + PushModal, ExportModal, VersionHistoryModal, SettingsModal, LoginModal (conditionally)
  + ConfirmDialog (promote-to-production confirmation)
  + PullResultPopup (conditionally)
  + isAutoSyncing pill
  + "set modpack root" nudge button (conditionally)
```

## Components

All under `src/renderer/lib/components/` unless noted.

### `Header/index.tsx`
Top bar: logo/title, page nav (Home/Logs/Settings via the exported `Page` type), user avatar with
a dropdown (profile link, logout). Props: `{ user, currentPage, onNavigate, onLogout }`. State:
`menuOpen` (dropdown, with click-outside via `menuRef`). Renders `WindowControls` (left-aligned on
macOS, right-aligned otherwise, per `window.electron.platform`).

### `Sidebar/index.tsx`
Right-hand dashboard column: Modpack Info card, Team Sync card (pull/push/undo-last-push buttons,
ahead/behind indicator, "version history" link), a conditional Profile Protection card
(snapshot/promote, only meaningful once a profile mode concept applies), Export button, and an
Issues/bugs card. Entirely controlled — no internal state beyond a local `Row` presentational
helper. Large prop surface (`config`, `syncStatus`, `issues`, `lastExportTime`,
`manifestVersion`, `modrinthRelease`, `onPull`, `onPush`, `onUndoLastPush`,
`isUndoingLastPush`, `onExport`, `onReportBug`, `profileMode`, `lastSnapshotTime`,
`onVersionHistory`, `onPromote`, `onTakeSnapshot`), all owned by `App.tsx`.

### `ActivityFeed/index.tsx` + `ActivityFeed/ActivityCard.tsx`
`index.tsx` is the list container (header, refresh button, no-token/loading-skeleton/empty/list
states) — presentational only, props `{ commits, isLoading, hasToken, onRefresh? }`.
`ActivityCard.tsx` is one collapsible commit card: expand/collapse, per-mod config-file lists,
mod icons. It lazily fetches its own detail if the card wasn't pre-enriched
(`window.electron.git.commitChanges(sha)`, falling back to `github.getCommitFiles`), and fetches
mod icons via `window.electron.modrinth.getIcons`. Clicking through opens the commit on GitHub via
`app.openExternal`.

### `PushModal/index.tsx`
Multi-phase (`idle → confirming → pushing → success/error`) modal. Loads a push preview on mount
(`git.pushPreview()`), shows added/updated/removed mods + changed files, requires a non-empty
commit message, confirms, then executes (`git.push({message})`) while streaming
`sync:progress`. On success, auto-closes after a 2s countdown (or immediately via a "Done"
button) — either way it calls `onSuccess(commit?)`, passing through the `PushedCommit` the main
process returned so `App.tsx` can show it optimistically without waiting on GitHub.

### `ExportModal/index.tsx`
Multi-phase (`form → generating → changelog → exporting → success/error`) modal driving the full
export wizard: pick version + output path (`export.saveDialog`), auto-fetch the latest Modrinth
release + current manifest version for defaults, generate a changelog
(`export.generateChangelog`), let the user edit it, then build the `.mrpack`
(`export.mrpack`) while streaming `export:progress`, finishing with a "show in folder" action
(`app.showInFolder`).

### `SettingsModal/index.tsx` (first-run/dismissible modal) and `SettingsPage/index.tsx` (persistent page)
Two different surfaces over largely the same settings, both built around
`getCachedSetting`/`setCachedSetting` (`settingsCache.ts`) rather than calling
`window.electron.settings.*` directly:
- `SettingsModal` — minimal, first-run-focused: modpack root + export dir, optionally
  dismissible/skippable. Auto-detects a root via the `modpack:root-found` event.
- `SettingsPage` — the full page: everything in the modal plus read-only mode toggle, auto-sync-
  on-launch toggle, profile protection (snapshot/restore/promote, dev vs. prod), Discord webhook
  (with a test-send button), Modrinth project ID, and Minecraft/Fabric Loader version fields. Uses
  two `ConfirmDialog`s (restore confirmation, promote confirmation showing a computed diff via
  `profile.promotePreview()`). The **Default Options** card (in the Modpack category) lists the
  three curated Default Options files (`options.txt`, `keybindings.txt`, `servers.dat`). The card
  is hidden entirely unless at least one file has a local or published copy. Each row shows a
  `Badge` with three states — "Same as published" (`info`, local and published copies are
  byte-identical via sha256, no Import button), "Ready to import" (`warning`, local copy exists,
  Import button shown) vs "Imported" (`success`, published only, no Import button) — plus the
  published file size + last-modified time, prefixed with "Current:" when both a local and a
  published copy exist. Importing a file that already has a published copy opens a `ConfirmDialog`;
  when the local copy is byte-identical to the published one (same sha256) the dialog says
  "Already published" and warns that only the local copy will be removed (confirm label "Discard
  local copy"), otherwise it shows "Replace default" with existing vs. new size/time
  (Replace/Cancel). Driven by `window.electron.defaults.getState()` (on mount) and
  `defaults.import(fileType)` (per-file, with a loading spinner on the button and toast feedback).

Both embed `SettingsModal/ProfileSelector.tsx` — scans all installed launchers (Modrinth, Prism,
MultiMC, ATLauncher, CurseForge, GDLauncher) via `modpack.listProfiles()`, lets the user
search/expand/pick a profile or browse manually (`app.selectDirectory()`), and calls
`modpack.setRootFromProfile(path)` on selection.

### `LoginModal/index.tsx`
Drives the GitHub OAuth device-flow UI: registers for the `device-auth:code` event, shows the
user code + a countdown, offers "copy code" and "open browser" (`app.openExternal`) actions, calls
`auth.start()` and resolves on success/failure/cancel (`auth.logout()` on explicit cancel).

### `PullResultPopup/index.tsx`
Presentational summary modal for a completed pull: collapsible added/updated/removed mod lists
(with icons) and a changed-files list. No IPC calls — purely renders the `PullResult` it's handed.

### `VersionHistoryModal/index.tsx`
Lists `VersionRecord`s from `versions.list()` with a rollback action
(`versions.rollback(versionId)`) per non-latest entry, confirmed via a native `window.confirm()`.
See STORAGE_MODEL.md's caveat — this list may currently always be empty since nothing writes
`.version_history.json`.

### `InitialSetupScreen/index.tsx`
Full-height replacement for the dashboard during first-run clone+pull. Purely presentational —
driven by `state`/`progress`/`error` props from `App.tsx`'s `initState`/`initProgress`/`initError`,
with an `onRetry` callback. No IPC calls of its own.

### `ConfirmDialog.tsx`
Generic reusable confirm modal (`open`, `title`, `description`, `details?`, `confirmLabel?`,
`cancelLabel?`, `variant: 'default'|'danger'|'warning'`, `onConfirm`, `onCancel`) with a `loading`
state while `onConfirm` is awaited. Used for the promote-to-production confirmation in `App.tsx`
and the restore/promote confirmations in `SettingsPage`.

### `LogsPage/index.tsx`
In-app log viewer — reads from the renderer-local `logger.ts` ring buffer via polling (500ms
interval), not IPC. Colors lines by a `[tag]` prefix convention (e.g. `[git:pull]`, `[push]`,
`[discord]`). Has copy-to-clipboard and clear actions.

### `WindowControls.tsx`
Custom titlebar buttons (the app is frameless): macOS-style traffic-light circles on the left, or
Windows/Linux minimize+close icons on the right, based on `window.electron.platform`. Calls
`app.minimize()` / `app.close()`.

## User flows

**Sign in → dashboard**: unauthenticated screen → "Sign in with GitHub" → `LoginModal` (device
flow) → on success, `checkAuth()` re-runs → `loadDashboard()` → either first-run setup
(`InitialSetupScreen`) or straight to the `ActivityFeed`/`Sidebar` dashboard.

**First run**: `SettingsModal` (or the nudge button → `SettingsPage`) to set a modpack root, if
not already set → once set, `runInitialSetup()` clones the versions repo and does a full pull,
showing progress via `InitialSetupScreen` → on success, `PullResultPopup` shows everything that
was downloaded (all "added", since there's nothing to diff against on a first pull).

**Push**: Sidebar "Push" button → `PushModal` (preview → confirm → progress → success) → on
success, `App.tsx` shows the new commit in the activity feed immediately and refreshes git status.

**Pull**: Sidebar "Pull Latest" button (or silent auto-sync on launch, if enabled) →
`git.pull()` → `PullResultPopup` if anything actually changed.

**Export**: Sidebar "Export" button → `ExportModal` (form → changelog generation/edit →
build → success, with a "show in folder" shortcut).

**Settings**: nav bar → `SettingsPage` — modpack root, export dir, sync toggles, Discord webhook,
Modrinth/version config, and profile protection (snapshot/restore, promote to production) all live
here.
