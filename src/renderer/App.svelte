<!--
  App shell — auth gate, page routing, dashboard data loading, first-run setup,
  auto-sync, and all modal orchestration.
-->
<script lang="ts">
  import Loader2 from '@lucide/svelte/icons/loader-2';

  import Header, { type Page } from './lib/components/Header/index.svelte';
  import ActivityFeed from './lib/components/ActivityFeed/index.svelte';
  import HistoryPage from './lib/components/HistoryPage/index.svelte';
  import Sidebar from './lib/components/Sidebar/index.svelte';
  import SettingsPage from './lib/components/SettingsPage/index.svelte';
  import LogsPage from './lib/components/LogsPage/index.svelte';
  import IssuesPage from './lib/components/IssuesPage/index.svelte';
  import PushModal from './lib/components/PushModal/index.svelte';
  import ExportModal from './lib/components/ExportModal/index.svelte';
  import SettingsModal from './lib/components/SettingsModal/index.svelte';
  import ConfirmDialog from './lib/components/ConfirmDialog.svelte';
  import LoginModal from './lib/components/LoginModal/index.svelte';
  import PullResultPopup from './lib/components/PullResultPopup/index.svelte';
  import InitialSetupScreen, { type InitProgress } from './lib/components/InitialSetupScreen/index.svelte';
  import Button from './lib/components/base/Button.svelte';
  import BrandLogo from './lib/components/common/BrandLogo.svelte';
  import GithubIcon from './lib/components/common/GithubIcon.svelte';
  import { prefetchModIcons } from './lib/utils/modIcons';
  import { initSettingsCache, getCachedSetting } from './lib/utils/settingsCache';
  import { toast } from './lib/state/toast.svelte';
  import { ipc } from './lib/ipc';

  import type {
    AppConfig,
    CommitCard,
    CommitChanges,
    CommitFile,
    GitHubUser,
    Issue,
    ModChange,
    PullResult,
    PushedCommit,
    SyncStatus,
  } from './lib/types';

  type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

  // First-run initialization phases. 'idle' = already set up (normal dashboard),
  // 'done' = init just finished (normal dashboard + pull popup).
  type InitState = 'idle' | 'cloning' | 'pulling' | 'done' | 'error';

  function parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  // ── Page routing ───────────────────────────────────────────────────────────
  let page = $state<Page>('home');

  // ── Core state ─────────────────────────────────────────────────────────────
  let authState = $state<AuthState>('loading');
  let user = $state<GitHubUser | null>(null);
  let config = $state<AppConfig | null>(null);
  let modpackRootSet = $state(false);

  // ── Dashboard data ─────────────────────────────────────────────────────────
  let commits = $state<CommitCard[]>([]);
  let issues = $state<Issue[]>([]);
  let syncStatus = $state<SyncStatus>({ branch: '', ahead: 0, behind: 0, modified: [], lastPull: null });
  let lastExportTime = $state<string | null>(null);
  let isLoadingCommits = $state(false);
  let manifestVersion = $state<number | null>(null);
  let modrinthRelease = $state<string | null>(null);

  // ── Modal visibility ───────────────────────────────────────────────────────
  let showPush = $state(false);
  let showExport = $state(false);
  let showSettings = $state(false);
  let showLogin = $state(false);
  let showUndoConfirm = $state(false);

  // ── Pull result popup (manual pulls + first-run pull) ─────────────────────
  let pullResult = $state<PullResult | null>(null);

  // ── Background auto-sync state ─────────────────────────────────────────────
  let isAutoSyncing = $state(false);

  // ── First-run initialization (clone versions repo + full pull) ─────────────
  let initState = $state<InitState>('idle');
  let initProgress = $state<InitProgress | null>(null);
  let initError = $state<string | null>(null);
  let initInFlight = false;

  let profileMode = $state<'dev' | 'prod'>('dev');
  let pendingMode = $state<'dev' | 'prod' | null>(null);
  let modeConfirmInfo = $state<{ latestPublished: string | null; checking: boolean; checkFailed: boolean } | null>(
    null,
  );

  // ── Undo last push state ───────────────────────────────────────────────────
  let isUndoingLastPush = $state(false);

  // ── Commit cache — tracks newest SHA so focus-refresh skips setCommits ─────
  let lastCommitSha: string | null = null;

  // ── Auth check ─────────────────────────────────────────────────────────────
  async function checkAuth(): Promise<boolean> {
    const r = await ipc.auth.check();
    if (r.authenticated && r.user) {
      user = r.user;
      authState = 'authenticated';
      return true;
    }
    user = null;
    authState = 'unauthenticated';
    return false;
  }

  // ── Config / git / GitHub loaders ──────────────────────────────────────────
  async function loadConfig() {
    const r = await ipc.config.read();
    if (r.success && r.data) config = r.data;
  }

  async function loadExportState() {
    const r = await ipc.config.readExportState();
    if (r.success && r.data) lastExportTime = r.data.timestamp;
    const saved = await ipc.settings.get('lastExportTime');
    if (saved) lastExportTime = saved;
  }

  async function loadGitStatus() {
    const r = await ipc.git.status();
    if (r.success && r.data) {
      const n = r.data;
      const prev = syncStatus;
      if (
        prev.branch === n.branch &&
        prev.ahead === n.ahead &&
        prev.behind === n.behind &&
        prev.lastPull === n.lastPull &&
        prev.modified.length === n.modified.length &&
        prev.modified.every((m, i) => m === n.modified[i])
      )
        return;
      syncStatus = n;
    }
  }

  async function loadIssues(cfg: AppConfig) {
    const parsed = parseRepoUrl(cfg.reports_repo || cfg.github_repo);
    if (!parsed) return;
    const r = await ipc.github.getIssues(parsed);
    if (r.success && r.data) {
      const prev = issues;
      if (prev.length === r.data.length && prev.every((issue, i) => issue.number === r.data![i].number)) return;
      issues = r.data;
    }
  }

  async function enrichCommitDetails(cards: CommitCard[], owner: string, repo: string) {
    await Promise.all(
      cards.slice(0, 8).map(async card => {
        const [r, changesRes] = await Promise.all([
          ipc.github.getCommitFiles({ owner, repo, sha: card.sha }),
          ipc.git.commitChanges(card.sha),
        ]);

        let changes: CommitChanges | undefined;
        if (
          changesRes.success &&
          changesRes.data &&
          (changesRes.data.mods.length > 0 || changesRes.data.otherFiles.length > 0)
        ) {
          changes = changesRes.data;
        } else if (r.success && r.data) {
          changes = {
            mods: r.data.modChanges.map(mc => ({
              slug: mc.slug,
              name: mc.name,
              iconUrl: null,
              versionNumber: null,
              status: mc.type,
            })),
            otherFiles: r.data.files.map(f => ({
              path: f.path,
              status: f.status as 'added' | 'modified' | 'removed',
            })),
          };
        }

        commits = commits.map(c =>
          c.sha === card.sha
            ? {
                ...c,
                files: r.success && r.data ? r.data.files : c.files,
                modChanges: r.success && r.data ? r.data.modChanges : c.modChanges,
                configChanged: r.success && r.data ? r.data.configChanged : c.configChanged,
                changes,
                detailsLoaded: true,
              }
            : c,
        );

        if (changes?.mods.length) {
          prefetchModIcons(changes.mods.map(m => m.slug));
        }
      }),
    );
  }

  async function loadCommits(cfg: AppConfig, since?: string): Promise<CommitCard[]> {
    const parsed = parseRepoUrl(cfg.github_repo);
    if (!parsed) return [];
    if (!since) isLoadingCommits = true;
    try {
      const r = await ipc.github.getCommits({
        ...parsed,
        branch: cfg.github_branch || 'main',
      });
      if (!r.success || !r.data) return [];

      const allCards: CommitCard[] = r.data.map((c: any) => ({
        sha: c.sha,
        message: c.commit.message.split('\n')[0],
        author: {
          login: c.author?.login || c.commit.author?.name || 'unknown',
          avatar_url: c.author?.avatar_url || 'https://github.com/ghost.png',
          html_url: c.author?.html_url || '',
        },
        date: c.commit.author?.date || new Date().toISOString(),
        url: c.html_url,
        modChanges: [] as ModChange[],
        configChanged: false,
        files: [] as CommitFile[],
        detailsLoaded: false,
      }));

      if (since) {
        // Nothing new — newest remote commit equals our cached SHA
        if (allCards.length > 0 && allCards[0].sha === since) return [];
        const sinceIdx = allCards.findIndex(c => c.sha === since);
        if (sinceIdx > 0) {
          // Commits at 0..sinceIdx-1 are new
          const newCards = allCards.slice(0, sinceIdx);
          const existingShas = new Set(commits.map(c => c.sha));
          const deduped = newCards.filter(c => !existingShas.has(c.sha));
          if (deduped.length > 0) commits = [...deduped, ...commits];
          void enrichCommitDetails(newCards, parsed.owner, parsed.repo);
          return newCards;
        }
        // since SHA not found in API window — fall through to full refresh
      }

      // Full refresh (initial load or since SHA fell outside API window)
      commits = allCards;
      void enrichCommitDetails(allCards, parsed.owner, parsed.repo);
      return allCards;
    } finally {
      if (!since) isLoadingCommits = false;
    }
  }

  // ── First-run initialization ───────────────────────────────────────────────
  // Clone the versions repo, then pull the entire modpack (all mods + overrides)
  // into the local profile. Idempotent + retryable: guarded against concurrent
  // runs, and only marks `initialSetupComplete` after BOTH steps succeed — so a
  // quit mid-pull simply retries on the next launch.
  async function runInitialSetup() {
    if (initInFlight) return;
    initInFlight = true;

    initError = null;
    initProgress = null;
    initState = 'cloning';

    try {
      // 1. Clone / refresh the OR-Beyond-Versions repo into userData.
      const repoRes = await ipc.git.ensureVersionsRepo();
      if (!repoRes.success) {
        throw new Error(repoRes.error || 'Could not set up the versions repository.');
      }

      // 2. Pull the full modpack. Progress streams via sync:progress (see effect).
      initState = 'pulling';
      const pullRes = await ipc.git.pull({ profilePath: getCachedSetting('modpackRoot') });
      if (!pullRes.success) {
        throw new Error(pullRes.error || 'Could not download the modpack.');
      }

      // Both steps succeeded — record completion so we never re-run this flow.
      await ipc.settings.set('initialSetupComplete', 'true');

      // Refresh dashboard state. Non-fatal — the pull already succeeded, so a
      // hiccup here must not block the completion popup.
      try {
        await loadGitStatus();
        const cfgRes = await ipc.config.read();
        if (cfgRes.success && cfgRes.data) {
          config = cfgRes.data;
          const refreshed = await loadCommits(cfgRes.data);
          if (refreshed.length > 0) lastCommitSha = refreshed[0].sha;
        }
      } catch (e) {
        console.warn('[initial-setup] post-pull refresh failed (dashboard will still load):', e);
      }

      initState = 'done';
      // Always surface what was downloaded on first setup (everything is "added").
      pullResult = pullRes;
      toast.success('Modpack downloaded \u2014 you\u2019re all set!');
    } catch (e: any) {
      console.error('[initial-setup] failed:', e);
      initError = e?.message || 'Setup failed unexpectedly.';
      initState = 'error';
    } finally {
      initInFlight = false;
    }
  }

  // Stream pull progress into the initialization screen while it's active.
  $effect(() => {
    if (initState !== 'cloning' && initState !== 'pulling') return;
    const unsub = ipc.git.onSyncProgress(data => (initProgress = data));
    return unsub;
  });

  // ── Bootstrap on auth ──────────────────────────────────────────────────────
  async function loadDashboard() {
    await loadConfig();
    await loadExportState();
    const cfgRes = await ipc.config.read();
    if (cfgRes.success && cfgRes.data) {
      config = cfgRes.data;
      const projectId = (await ipc.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
      const [mvRes, mrRes, initialCards] = await Promise.all([
        ipc.export.manifestVersion(),
        ipc.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
        loadCommits(cfgRes.data),
        loadIssues(cfgRes.data),
        loadGitStatus(),
      ]);
      if (mvRes.success) manifestVersion = mvRes.versionId;
      if (mrRes.version_number) modrinthRelease = mrRes.version_number;
      if (initialCards && initialCards.length > 0) lastCommitSha = initialCards[0].sha;
    }

    const mode = await ipc.profile.getMode();
    profileMode = mode;

    // Surface a hint if modpack root isn't configured yet.
    const root = await ipc.settings.get('modpackRoot');
    modpackRootSet = !!root;
    if (!root) {
      toast('Set your modpack root in Settings to enable git + export', { icon: '\u2699\uFE0F' });
      showSettings = true;
      return;
    }

    // First run: the versions repo has never been cloned/pulled. Kick off the
    // guided initialization instead of the silent auto-sync. This also covers
    // the retry case where the user quit mid-pull on a previous launch.
    const setupComplete = await ipc.settings.get('initialSetupComplete');
    if (setupComplete !== 'true') {
      void runInitialSetup();
      return;
    }

    // Auto-sync on launch — opt-in (defaults off) since it can silently overwrite
    // local changes the user hasn't pushed yet. When disabled, the user must click
    // "Pull Latest" manually. Same handler as manual pull, with index.lock retry.
    const autoSyncEnabled = await ipc.settings.getAutoSyncOnLaunch();
    if (!autoSyncEnabled) return;

    void (async () => {
      isAutoSyncing = true;
      try {
        const applyResult = (result: any) => {
          const hasChanges =
            (result.addedMods?.length || 0) +
              (result.updatedMods?.length || 0) +
              (result.removedMods?.length || 0) +
              (result.changedFiles?.length || 0) >
            0;
          if (hasChanges) pullResult = result;
        };

        const result = await ipc.git.pull({ profilePath: getCachedSetting('modpackRoot') });
        if (result?.success) {
          await loadGitStatus();
          applyResult(result);
        } else if (result?.error?.includes('index.lock')) {
          // Lock file from a previous crash — handler will have cleaned it; retry once
          console.warn('[auto-sync] index.lock detected, retrying in 2s\u2026');
          await new Promise(res => setTimeout(res, 2000));
          const retry = await ipc.git.pull({ profilePath: getCachedSetting('modpackRoot') });
          if (retry?.success) {
            await loadGitStatus();
            applyResult(retry);
          } else {
            console.warn('[auto-sync] retry failed:', retry?.error);
          }
        } else {
          console.warn('[auto-sync] pull failed:', result?.error);
        }
      } catch (e) {
        console.warn('[auto-sync] unexpected error:', e);
      }
      isAutoSyncing = false;
    })();
  }

  // ── App startup ────────────────────────────────────────────────────────────
  $effect(() => {
    void (async () => {
      await initSettingsCache();
      const ok = await checkAuth();
      if (ok) await loadDashboard();
    })();
  });

  // ── Auto-refresh on window focus (debounced – ignore if last refresh <30s) ─
  let lastFocusRefresh = 0;
  $effect(() => {
    if (authState !== 'authenticated') return;
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh < 30_000) return;
      lastFocusRefresh = now;
      if (config) {
        void loadCommits(config, lastCommitSha ?? undefined).then(newCards => {
          if (newCards.length > 0) lastCommitSha = newCards[0].sha;
        });
        void loadGitStatus();
        void loadIssues(config);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  });

  function handleRefreshActivity() {
    if (config) {
      void loadCommits(config);
      void loadGitStatus();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handlePull() {
    const tid = toast.loading('Pulling latest\u2026');
    const r = await ipc.git.pull({ profilePath: getCachedSetting('modpackRoot') });
    toast.dismiss(tid);
    if (r.success) {
      toast.success('Pulled & synced mods');
      // Refresh UI state — wrapped so an exception here never blocks the popup
      try {
        await loadGitStatus();
        if (config) {
          const refreshed = await loadCommits(config);
          if (refreshed.length > 0) lastCommitSha = refreshed[0].sha;
        }
      } catch (e) {
        console.warn('[handlePull] post-pull refresh failed (popup will still show):', e);
      }
      const hasChanges =
        (r.addedMods?.length || 0) +
          (r.updatedMods?.length || 0) +
          (r.removedMods?.length || 0) +
          (r.changedFiles?.length || 0) >
        0;
      if (hasChanges) pullResult = r;
    } else {
      toast.error(`Pull failed: ${r.error}`);
    }
  }

  async function performUndoLastPush() {
    isUndoingLastPush = true;
    const tid = toast.loading('Undoing last push\u2026');
    try {
      const r = await ipc.git.undoLastPush();
      toast.dismiss(tid);
      if (r.success) {
        toast.success('Last push undone successfully');
        try {
          await loadGitStatus();
          if (config) {
            const refreshed = await loadCommits(config);
            if (refreshed.length > 0) lastCommitSha = refreshed[0].sha;
          }
        } catch {}
      } else {
        toast.error(`Undo failed: ${r.error}`);
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(`Undo failed: ${e?.message ?? 'Unexpected error'}`);
    } finally {
      isUndoingLastPush = false;
    }
  }

  function handleUndoLastPush() {
    showUndoConfirm = true;
  }

  async function handlePushSuccess(commit?: PushedCommit) {
    showPush = false;

    // Show the just-pushed commit immediately — we already have its sha/message/
    // author/timestamp from git:push, so there's no need to wait on GitHub's API,
    // which can lag a moment behind a commit that was just pushed.
    let optimisticCard: CommitCard | null = null;
    if (commit && config) {
      const parsed = parseRepoUrl(config.github_repo);
      if (parsed) {
        optimisticCard = {
          sha: commit.sha,
          message: commit.message.split('\n')[0],
          author: {
            login: commit.author.name,
            avatar_url: `https://github.com/${commit.author.name}.png`,
            html_url: `https://github.com/${commit.author.name}`,
          },
          date: commit.timestamp,
          url: `https://github.com/${parsed.owner}/${parsed.repo}/commit/${commit.sha}`,
          modChanges: [],
          configChanged: false,
          files: [],
          detailsLoaded: false,
        };
        const card = optimisticCard;
        if (!commits.some(c => c.sha === card.sha)) commits = [card, ...commits];
        lastCommitSha = card.sha;
      }
    }

    const [mvRes] = await Promise.all([ipc.export.manifestVersion(), loadGitStatus()]);
    if (mvRes.success) manifestVersion = mvRes.versionId;

    // Reconcile with GitHub shortly after — replaces the optimistic card with the
    // authoritative one (full details: files, mod changes) once the API catches up.
    const cfg = config;
    if (cfg) {
      const card = optimisticCard;
      setTimeout(() => {
        void loadCommits(cfg).then(refreshed => {
          if (refreshed.length > 0) lastCommitSha = refreshed[0].sha;
          // GitHub's API hasn't caught up yet — put the optimistic card back so
          // the just-pushed commit doesn't appear to vanish from the feed.
          if (card && !refreshed.some(c => c.sha === card.sha)) {
            if (!commits.some(c => c.sha === card.sha)) commits = [card, ...commits];
          }
        });
      }, 500);
    }
  }

  async function handleExportSuccess() {
    showExport = false;
    await loadConfig();
    await loadExportState();
    if (config) await loadCommits(config);
  }

  async function handleSettingsSaved() {
    showSettings = false;
    const root = await ipc.settings.get('modpackRoot');
    modpackRootSet = !!root;
    const projectId = (await ipc.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
    const [mrRes] = await Promise.all([
      ipc.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
      loadGitStatus(),
      loadExportState(),
    ]);
    if (mrRes.version_number) modrinthRelease = mrRes.version_number;

    // If this Save completed first-time setup (root now set, repo never
    // initialized), dismiss the overlay and start the guided clone + pull.
    if (root) {
      const setupComplete = await ipc.settings.get('initialSetupComplete');
      if (setupComplete !== 'true') void runInitialSetup();
    }
  }

  function handleSettingsSkip() {
    showSettings = false;
  }

  async function handleModeChange(next: 'dev' | 'prod') {
    if (next === profileMode) return;
    if (next === 'prod') {
      modeConfirmInfo = { latestPublished: null, checking: true, checkFailed: false };
      pendingMode = next;
      const projectId = (await ipc.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
      const mr = await ipc.export
        .latestModrinthVersion(projectId)
        .catch(() => ({ version_number: null as null, reason: 'Could not fetch from Modrinth' }));
      modeConfirmInfo = {
        latestPublished: mr?.version_number ?? null,
        checking: false,
        checkFailed: !!mr?.reason && mr.reason !== 'No published releases found',
      };
    } else {
      modeConfirmInfo = { latestPublished: null, checking: false, checkFailed: false };
      pendingMode = next;
    }
  }

  async function handleConfirmModeChange() {
    if (!pendingMode) return;
    await ipc.profile.setMode(pendingMode);
    profileMode = pendingMode;
    pendingMode = null;
    modeConfirmInfo = null;
    toast.success(
      pendingMode === 'prod'
        ? 'Production mode enabled — exports will be published to Modrinth'
        : 'Development mode enabled',
    );
  }

  function handleLoginRequest() {
    showLogin = true;
  }

  async function handleLoginSuccess() {
    showLogin = false;
    const ok = await checkAuth();
    if (ok) {
      toast.success('Signed in successfully');
      await loadDashboard();
    }
  }

  async function handleLogout() {
    await ipc.auth.logout();
    user = null;
    authState = 'unauthenticated';
    commits = [];
    issues = [];
    syncStatus = { branch: '', ahead: 0, behind: 0, modified: [], lastPull: null };
    showSettings = false;
    initState = 'idle';
    initProgress = null;
    initError = null;
    toast.success('Signed out');
  }

  // Whether the first-run setup screen should replace the dashboard body.
  const initActive = $derived(initState === 'cloning' || initState === 'pulling' || initState === 'error');
</script>

{#if authState === 'loading'}
  <!-- ── Render: loading splash ── -->
  <div class="flex items-center justify-center h-screen bg-background drag-region">
    <div class="flex flex-col items-center gap-3 no-drag">
      <BrandLogo sizeClass="w-10 h-10" />
      <div class="flex items-center gap-2 text-muted text-sm">
        <Loader2 size={14} class="animate-spin" />
        Checking credentials\u2026
      </div>
    </div>
  </div>
{:else if authState === 'unauthenticated'}
  <!-- ── Render: unauthenticated ── -->
  <div class="flex flex-col h-screen bg-background overflow-hidden">
    <Header user={null} currentPage={page} onNavigate={p => (page = p)} onLogout={handleLogout} onSignIn={handleLoginRequest} />

    <div class="flex-1 flex items-center justify-center px-6">
      <div class="text-center max-w-sm">
        <div class="flex justify-center mb-5">
          <BrandLogo sizeClass="w-16 h-16" />
        </div>
        <h2 class="text-foreground text-lg font-semibold mb-2">Welcome to ORB Modpack Exporter</h2>
        <p class="text-muted text-sm mb-7 leading-relaxed">
          Sign in with your GitHub account to get started with modpack collaboration.
          You must be a member of the OR-Beyond organization.
        </p>
        <Button variant="primary" icon={GithubIcon} onclick={handleLoginRequest} class="px-6 py-2.5 rounded-[10px]">
          Sign in with GitHub
        </Button>
      </div>
    </div>

    {#if showLogin}
      <LoginModal onClose={() => (showLogin = false)} onSuccess={handleLoginSuccess} />
    {/if}
  </div>
{:else}
  <!-- ── Render: authenticated dashboard ── -->
  <div class="flex flex-col h-screen bg-background overflow-hidden">
    <Header user={user} currentPage={page} onNavigate={p => (page = p)} onLogout={handleLogout} />

    {#if page === 'home'}
      {#if initActive}
        <InitialSetupScreen
          state={initState as 'cloning' | 'pulling' | 'error'}
          progress={initProgress}
          error={initError}
          onRetry={runInitialSetup}
        />
      {:else}
        <div class="flex flex-1 overflow-hidden">
          <ActivityFeed
            {commits}
            isLoading={isLoadingCommits}
            hasToken={true}
            onRefresh={handleRefreshActivity}
            limit={5}
            onViewAll={() => (page = 'history')}
          />
          <Sidebar
            {config}
            {syncStatus}
            {issues}
            {lastExportTime}
            {manifestVersion}
            {modrinthRelease}
            onPull={handlePull}
            onPush={() => (showPush = true)}
            onUndoLastPush={handleUndoLastPush}
            {isUndoingLastPush}
            onExport={() => (showExport = true)}
            onReportBug={() =>
              config &&
              ipc.app.openExternal(`${(config.reports_repo || config.github_repo).replace('.git', '')}/issues/new`)}
            {profileMode}
            onModeChange={handleModeChange}
          />
        </div>
      {/if}
    {:else if page === 'history'}
      <HistoryPage {commits} isLoading={isLoadingCommits} onRefresh={handleRefreshActivity} />
    {:else if page === 'settings'}
      <SettingsPage
        onBack={() => (page = 'home')}
        onSaved={async () => {
          const projectId = (await ipc.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
          const [mrRes] = await Promise.all([
            ipc.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
          ]);
          if (mrRes.version_number) modrinthRelease = mrRes.version_number;
        }}
      />
    {:else if page === 'issues'}
      <IssuesPage />
    {:else if page === 'logs'}
      <LogsPage />
    {/if}

    {#if showPush}
      <PushModal onClose={() => (showPush = false)} onSuccess={handlePushSuccess} />
    {/if}
    {#if showExport && config}
      <ExportModal {config} onClose={() => (showExport = false)} onSuccess={handleExportSuccess} />
    {/if}
    {#if showSettings}
      <SettingsModal showSkip onClose={handleSettingsSkip} onSaved={handleSettingsSaved} />
    {/if}
    {#if showLogin}
      <LoginModal onClose={() => (showLogin = false)} onSuccess={handleLoginSuccess} />
    {/if}

    <ConfirmDialog
      open={showUndoConfirm}
      title="Undo Last Push"
      description="This will revert all changes from your most recent push and update everyone."
      confirmLabel="Undo Push"
      variant="danger"
      onConfirm={() => {
        showUndoConfirm = false;
        void performUndoLastPush();
      }}
      onCancel={() => (showUndoConfirm = false)}
    />

    <ConfirmDialog
      open={pendingMode !== null}
      title={pendingMode === 'prod' ? 'Switch to Production Mode?' : 'Switch to Development Mode?'}
      description={pendingMode === 'prod'
        ? 'Production mode exports from the production workspace and also publishes the modpack directly to Modrinth — the release goes live for all players, in addition to the normal Git flow. This is a sensitive action; every export stays tracked in History.'
        : 'Development mode exports from your development profile and only runs the normal Git flow. Nothing is published to Modrinth.'}
      details={pendingMode === 'prod' && modeConfirmInfo
        ? modeConfirmInfo.checking
          ? 'Checking latest published release…'
          : modeConfirmInfo.checkFailed
            ? "Couldn't check the latest published release (offline?)."
            : modeConfirmInfo.latestPublished
              ? `Latest published release: v${modeConfirmInfo.latestPublished}`
              : 'No published releases yet — this will be the first.'
        : null}
      confirmLabel={pendingMode === 'prod' ? 'Switch to Production' : 'Switch to Development'}
      variant={pendingMode === 'prod' ? 'warning' : 'default'}
      onConfirm={handleConfirmModeChange}
      onCancel={() => {
        pendingMode = null;
        modeConfirmInfo = null;
      }}
    />
    {#if pullResult}
      <PullResultPopup
        addedMods={pullResult.addedMods ?? []}
        updatedMods={pullResult.updatedMods ?? []}
        removedMods={pullResult.removedMods ?? []}
        changedFiles={pullResult.changedFiles ?? []}
        onDismiss={() => (pullResult = null)}
      />
    {/if}

    {#if isAutoSyncing}
      <div
        class="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs z-30 select-none bg-overlay/90 text-muted-foreground border border-line/8"
      >
        <span class="w-1.5 h-1.5 rounded-full animate-pulse bg-link"></span>
        Syncing\u2026
      </div>
    {/if}

    {#if !modpackRootSet && !showSettings && !initActive && page === 'home'}
      <button
        onclick={() => (page = 'settings')}
        class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium transition-colors shadow-lg z-30 bg-warning text-on-warning"
      >
        {`\u2699 Set modpack root in Settings`}
      </button>
    {/if}
  </div>
{/if}
