import React, { useCallback, useEffect, useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/lib/components/Header';
import type { Page } from '@/lib/components/Header';
import ActivityFeed from '@/lib/components/ActivityFeed';
import HistoryPage from '@/lib/components/HistoryPage';
import Sidebar from '@/lib/components/Sidebar';
import SettingsPage from '@/lib/components/SettingsPage';
import LogsPage from '@/lib/components/LogsPage';
import IssuesPage from '@/lib/components/IssuesPage';
import PushModal from '@/lib/components/PushModal';
import ExportModal from '@/lib/components/ExportModal';
import SettingsModal from '@/lib/components/SettingsModal';
import ConfirmDialog from '@/lib/components/ConfirmDialog';
import LoginModal from '@/lib/components/LoginModal';
import PullResultPopup from '@/lib/components/PullResultPopup';
import InitialSetupScreen, { InitProgress } from '@/lib/components/InitialSetupScreen';
import Button from '@/lib/components/base/Button';
import BrandLogo from '@/lib/components/common/BrandLogo';
import { prefetchModIcons } from '@/lib/utils/modIcons';
import { initLogger } from '@/lib/utils/logger';
import { initSettingsCache } from '@/lib/utils/settingsCache';

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
} from '@/lib/types';

// ─ Init logger once on app boot (before any rendering) ──────────────────────
initLogger();

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

// First-run initialization phases. 'idle' = already set up (normal dashboard),
// 'done' = init just finished (normal dashboard + pull popup).
type InitState = 'idle' | 'cloning' | 'pulling' | 'done' | 'error';

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export default function App() {
  // ── Page routing ───────────────────────────────────────────────────────────
  const [page, setPage] = useState<Page>('home');

  // ── Core state ─────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [modpackRootSet, setModpackRootSet] = useState(false);

  // ── Dashboard data ─────────────────────────────────────────────────────────
  const [commits, setCommits] = useState<CommitCard[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    branch: '', ahead: 0, behind: 0, modified: [], lastPull: null,
  });
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [manifestVersion, setManifestVersion] = useState<number | null>(null);
  const [modrinthRelease, setModrinthRelease] = useState<string | null>(null);

  // ── Modal visibility ───────────────────────────────────────────────────────
  const [showPush, setShowPush] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  // ── Pull result popup (manual pulls + first-run pull) ─────────────────────
  const [pullResult, setPullResult] = useState<PullResult | null>(null);

  // ── Background auto-sync state ─────────────────────────────────────────────
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // ── First-run initialization (clone versions repo + full pull) ─────────────
  const [initState, setInitState] = useState<InitState>('idle');
  const [initProgress, setInitProgress] = useState<InitProgress | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const initInFlightRef = React.useRef(false);

  const [profileMode, setProfileMode] = useState<'dev' | 'prod'>('dev');
  const [pendingMode, setPendingMode] = useState<'dev' | 'prod' | null>(null);
  const [modeConfirmInfo, setModeConfirmInfo] = useState<{ latestPublished: string | null; checking: boolean; checkFailed: boolean } | null>(null);

  // ── Undo last push state ───────────────────────────────────────────────────
  const [isUndoingLastPush, setIsUndoingLastPush] = useState(false);

  // ── Commit cache — tracks newest SHA so focus-refresh skips setCommits ─────
  const lastCommitShaRef = React.useRef<string | null>(null);

  // ── Auth check ─────────────────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const r = await window.electron.auth.check();
    if (r.authenticated && r.user) {
      setUser(r.user);
      setAuthState('authenticated');
      return true;
    }
    setUser(null);
    setAuthState('unauthenticated');
    return false;
  }, []);

  // ── Config / git / GitHub loaders ──────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    const r = await window.electron.config.read();
    if (r.success && r.data) setConfig(r.data);
  }, []);

  const loadExportState = useCallback(async () => {
    const r = await window.electron.config.readExportState();
    if (r.success && r.data) setLastExportTime(r.data.timestamp);
    const saved = await window.electron.settings.get('lastExportTime');
    if (saved) setLastExportTime(saved);
  }, []);

  const loadGitStatus = useCallback(async () => {
    const r = await window.electron.git.status();
    if (r.success && r.data) {
      setSyncStatus(prev => {
        const n = r.data!;
        if (
          prev.branch === n.branch &&
          prev.ahead === n.ahead &&
          prev.behind === n.behind &&
          prev.lastPull === n.lastPull &&
          prev.modified.length === n.modified.length &&
          prev.modified.every((m, i) => m === n.modified[i])
        ) return prev;
        return n;
      });
    }
  }, []);

  const loadIssues = useCallback(async (cfg: AppConfig) => {
    const parsed = parseRepoUrl(cfg.reports_repo || cfg.github_repo);
    if (!parsed) return;
    const r = await window.electron.github.getIssues(parsed);
    if (r.success && r.data) {
      setIssues(prev => {
        if (
          prev.length === r.data!.length &&
          prev.every((issue, i) => issue.number === r.data![i].number)
        ) return prev;
        return r.data!;
      });
    }
  }, []);

  const enrichCommitDetails = useCallback(
    async (cards: CommitCard[], owner: string, repo: string) => {
      await Promise.all(
        cards.slice(0, 8).map(async card => {
          const [r, changesRes] = await Promise.all([
            window.electron.github.getCommitFiles({ owner, repo, sha: card.sha }),
            window.electron.git.commitChanges(card.sha),
          ]);

          let changes: CommitChanges | undefined;
          if (changesRes.success && changesRes.data &&
              (changesRes.data.mods.length > 0 || changesRes.data.otherFiles.length > 0)) {
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

          setCommits(prev =>
            prev.map(c =>
              c.sha === card.sha
                ? {
                    ...c,
                    files: r.success && r.data ? r.data.files : c.files,
                    modChanges: r.success && r.data ? r.data.modChanges : c.modChanges,
                    configChanged: r.success && r.data ? r.data.configChanged : c.configChanged,
                    changes,
                    detailsLoaded: true,
                  }
                  : c
            )
          );

          if (changes?.mods.length) {
            prefetchModIcons(changes.mods.map(m => m.slug));
          }
        })
      );
    },
    []
  );

  const loadCommits = useCallback(
    async (cfg: AppConfig, since?: string): Promise<CommitCard[]> => {
      const parsed = parseRepoUrl(cfg.github_repo);
      if (!parsed) return [];
      if (!since) setIsLoadingCommits(true);
      try {
        const r = await window.electron.github.getCommits({
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
            setCommits(prev => {
              const existingShas = new Set(prev.map(c => c.sha));
              const deduped = newCards.filter(c => !existingShas.has(c.sha));
              if (deduped.length === 0) return prev;
              return [...deduped, ...prev];
            });
            enrichCommitDetails(newCards, parsed.owner, parsed.repo);
            return newCards;
          }
          // since SHA not found in API window — fall through to full refresh
        }

        // Full refresh (initial load or since SHA fell outside API window)
        setCommits(allCards);
        enrichCommitDetails(allCards, parsed.owner, parsed.repo);
        return allCards;
      } finally {
        if (!since) setIsLoadingCommits(false);
      }
    },
    [enrichCommitDetails]
  );

  // ── First-run initialization ───────────────────────────────────────────────
  // Clone the versions repo, then pull the entire modpack (all mods + overrides)
  // into the local profile. Idempotent + retryable: guarded against concurrent
  // runs, and only marks `initialSetupComplete` after BOTH steps succeed — so a
  // quit mid-pull simply retries on the next launch.
  const runInitialSetup = useCallback(async () => {
    if (initInFlightRef.current) return;
    initInFlightRef.current = true;

    setInitError(null);
    setInitProgress(null);
    setInitState('cloning');

    try {
      // 1. Clone / refresh the OR-Beyond-Versions repo into userData.
      const repoRes = await window.electron.git.ensureVersionsRepo();
      if (!repoRes.success) {
        throw new Error(repoRes.error || 'Could not set up the versions repository.');
      }

      // 2. Pull the full modpack. Progress streams via sync:progress (see effect).
      setInitState('pulling');
      const pullRes = await window.electron.git.pull();
      if (!pullRes.success) {
        throw new Error(pullRes.error || 'Could not download the modpack.');
      }

      // Both steps succeeded — record completion so we never re-run this flow.
      await window.electron.settings.set('initialSetupComplete', 'true');

      // Refresh dashboard state. Non-fatal — the pull already succeeded, so a
      // hiccup here must not block the completion popup.
      try {
        await loadGitStatus();
        const cfgRes = await window.electron.config.read();
        if (cfgRes.success && cfgRes.data) {
          setConfig(cfgRes.data);
          const refreshed = await loadCommits(cfgRes.data);
          if (refreshed.length > 0) lastCommitShaRef.current = refreshed[0].sha;
        }
      } catch (e) {
        console.warn('[initial-setup] post-pull refresh failed (dashboard will still load):', e);
      }

      setInitState('done');
      // Always surface what was downloaded on first setup (everything is "added").
      setPullResult(pullRes);
      toast.success('Modpack downloaded \u2014 you\u2019re all set!');
    } catch (e: any) {
      console.error('[initial-setup] failed:', e);
      setInitError(e?.message || 'Setup failed unexpectedly.');
      setInitState('error');
    } finally {
      initInFlightRef.current = false;
    }
  }, [loadGitStatus, loadCommits]);

  // Stream pull progress into the initialization screen while it's active.
  useEffect(() => {
    if (initState !== 'cloning' && initState !== 'pulling') return;
    window.electron.git.onSyncProgress(data => setInitProgress(data));
    return () => window.electron.git.offSyncProgress();
  }, [initState]);

  // ── Bootstrap on auth ──────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    await loadConfig();
    await loadExportState();
    const cfgRes = await window.electron.config.read();
    if (cfgRes.success && cfgRes.data) {
      setConfig(cfgRes.data);
      const projectId =
        (await window.electron.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
      const [mvRes, mrRes, initialCards] = await Promise.all([
        window.electron.export.manifestVersion(),
        window.electron.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
        loadCommits(cfgRes.data),
        loadIssues(cfgRes.data),
        loadGitStatus(),
      ]);
      if (mvRes.success) setManifestVersion(mvRes.versionId);
      if (mrRes.version_number) setModrinthRelease(mrRes.version_number);
      if (initialCards && initialCards.length > 0) lastCommitShaRef.current = initialCards[0].sha;
    }

    const mode = await window.electron.profile.getMode();
    setProfileMode(mode);

    // Surface a hint if modpack root isn't configured yet.
    const root = await window.electron.settings.get('modpackRoot');
    setModpackRootSet(!!root);
    if (!root) {
      toast('Set your modpack root in Settings to enable git + export', { icon: '\u2699\uFE0F' });
      setShowSettings(true);
      return;
    }

    // First run: the versions repo has never been cloned/pulled. Kick off the
    // guided initialization instead of the silent auto-sync. This also covers
    // the retry case where the user quit mid-pull on a previous launch.
    const setupComplete = await window.electron.settings.get('initialSetupComplete');
    if (setupComplete !== 'true') {
      void runInitialSetup();
      return;
    }

    // Auto-sync on launch — opt-in (defaults off) since it can silently overwrite
    // local changes the user hasn't pushed yet. When disabled, the user must click
    // "Pull Latest" manually. Same handler as manual pull, with index.lock retry.
    const autoSyncEnabled = await window.electron.settings.getAutoSyncOnLaunch();
    if (!autoSyncEnabled) return;

    void (async () => {
      setIsAutoSyncing(true);
      try {
        const applyResult = (result: any) => {
          const hasChanges =
            (result.addedMods?.length || 0) +
            (result.updatedMods?.length || 0) +
            (result.removedMods?.length || 0) +
            (result.changedFiles?.length || 0) > 0;
          if (hasChanges) setPullResult(result);
        };

        const result = await window.electron.git.pull();
        if (result?.success) {
          await loadGitStatus();
          applyResult(result);
        } else if (result?.error?.includes('index.lock')) {
          // Lock file from a previous crash — handler will have cleaned it; retry once
          console.warn('[auto-sync] index.lock detected, retrying in 2s\u2026');
          await new Promise(res => setTimeout(res, 2000));
          const retry = await window.electron.git.pull();
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
      setIsAutoSyncing(false);
    })();
  }, [loadConfig, loadExportState, loadCommits, loadIssues, loadGitStatus, runInitialSetup]);

  // ── App startup ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await initSettingsCache();
      const ok = await checkAuth();
      if (ok) await loadDashboard();
    })();
  }, [checkAuth, loadDashboard]);

  // ── Auto-refresh on window focus (debounced – ignore if last refresh <30s) ─
  const lastFocusRefresh = React.useRef(0);
  useEffect(() => {
    if (authState !== 'authenticated') return;
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh.current < 30_000) return;
      lastFocusRefresh.current = now;
      if (config) {
        loadCommits(config, lastCommitShaRef.current ?? undefined).then(newCards => {
          if (newCards.length > 0) lastCommitShaRef.current = newCards[0].sha;
        });
        loadGitStatus();
        loadIssues(config);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authState, config, loadCommits, loadGitStatus, loadIssues]);

  const handleRefreshActivity = useCallback(() => {
    if (config) {
      loadCommits(config);
      loadGitStatus();
    }
  }, [config, loadCommits, loadGitStatus]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePull = async () => {
    const tid = toast.loading('Pulling latest\u2026');
    const r = await window.electron.git.pull();
    toast.dismiss(tid);
    if (r.success) {
      toast.success('Pulled & synced mods');
      // Refresh UI state — wrapped so an exception here never blocks the popup
      try {
        await loadGitStatus();
        if (config) {
          const refreshed = await loadCommits(config);
          if (refreshed.length > 0) lastCommitShaRef.current = refreshed[0].sha;
        }
      } catch (e) {
        console.warn('[handlePull] post-pull refresh failed (popup will still show):', e);
      }
      const hasChanges =
        (r.addedMods?.length || 0) +
        (r.updatedMods?.length || 0) +
        (r.removedMods?.length || 0) +
        (r.changedFiles?.length || 0) > 0;
      if (hasChanges) setPullResult(r);
    } else {
      toast.error(`Pull failed: ${r.error}`);
    }
  };

  const performUndoLastPush = useCallback(async () => {
    setIsUndoingLastPush(true);
    const tid = toast.loading('Undoing last push\u2026');
    try {
      const r = await window.electron.git.undoLastPush();
      toast.dismiss(tid);
      if (r.success) {
        toast.success('Last push undone successfully');
        try {
          await loadGitStatus();
          if (config) {
            const refreshed = await loadCommits(config);
            if (refreshed.length > 0) lastCommitShaRef.current = refreshed[0].sha;
          }
        } catch {}
      } else {
        toast.error(`Undo failed: ${r.error}`);
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(`Undo failed: ${e?.message ?? 'Unexpected error'}`);
    } finally {
      setIsUndoingLastPush(false);
    }
  }, [config, loadGitStatus, loadCommits]);

  const handleUndoLastPush = () => setShowUndoConfirm(true);

  const handlePushSuccess = async (commit?: PushedCommit) => {
    setShowPush(false);

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
        setCommits(prev => (prev.some(c => c.sha === card.sha) ? prev : [card, ...prev]));
        lastCommitShaRef.current = card.sha;
      }
    }

    const [mvRes] = await Promise.all([
      window.electron.export.manifestVersion(),
      loadGitStatus(),
    ]);
    if (mvRes.success) setManifestVersion(mvRes.versionId);

    // Reconcile with GitHub shortly after — replaces the optimistic card with the
    // authoritative one (full details: files, mod changes) once the API catches up.
    if (config) {
      const card = optimisticCard;
      setTimeout(() => {
        loadCommits(config).then(refreshed => {
          if (refreshed.length > 0) lastCommitShaRef.current = refreshed[0].sha;
          // GitHub's API hasn't caught up yet — put the optimistic card back so
          // the just-pushed commit doesn't appear to vanish from the feed.
          if (card && !refreshed.some(c => c.sha === card.sha)) {
            setCommits(prev => (prev.some(c => c.sha === card.sha) ? prev : [card, ...prev]));
          }
        });
      }, 500);
    }
  };

  const handleExportSuccess = async () => {
    setShowExport(false);
    await loadConfig();
    await loadExportState();
    if (config) await loadCommits(config);
  };

  const handleSettingsSaved = async () => {
    setShowSettings(false);
    const root = await window.electron.settings.get('modpackRoot');
    setModpackRootSet(!!root);
    const projectId =
      (await window.electron.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
    const [mrRes] = await Promise.all([
      window.electron.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
      loadGitStatus(),
      loadExportState(),
    ]);
    if (mrRes.version_number) setModrinthRelease(mrRes.version_number);

    // If this Save completed first-time setup (root now set, repo never
    // initialized), dismiss the overlay and start the guided clone + pull.
    if (root) {
      const setupComplete = await window.electron.settings.get('initialSetupComplete');
      if (setupComplete !== 'true') void runInitialSetup();
    }
  };

  const handleSettingsSkip = () => {
    setShowSettings(false);
  };

  const handleModeChange = async (next: 'dev' | 'prod') => {
    if (next === profileMode) return;
    if (next === 'prod') {
      setModeConfirmInfo({ latestPublished: null, checking: true, checkFailed: false });
      setPendingMode(next);
      const projectId =
        (await window.electron.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
      const mr = await window.electron.export
        .latestModrinthVersion(projectId)
        .catch(() => ({ version_number: null as null, reason: 'Could not fetch from Modrinth' }));
      setModeConfirmInfo({
        latestPublished: mr?.version_number ?? null,
        checking: false,
        checkFailed: !!mr?.reason && mr.reason !== 'No published releases found',
      });
    } else {
      setModeConfirmInfo({ latestPublished: null, checking: false, checkFailed: false });
      setPendingMode(next);
    }
  };

  const handleConfirmModeChange = async () => {
    if (!pendingMode) return;
    await window.electron.profile.setMode(pendingMode);
    setProfileMode(pendingMode);
    setPendingMode(null);
    setModeConfirmInfo(null);
    toast.success(
      pendingMode === 'prod'
        ? 'Production mode enabled — exports will be published to Modrinth'
        : 'Development mode enabled'
    );
  };

  const handleLoginRequest = () => setShowLogin(true);

  const handleLoginSuccess = async () => {
    setShowLogin(false);
    const ok = await checkAuth();
    if (ok) {
      toast.success('Signed in successfully');
      await loadDashboard();
    }
  };

  const handleLogout = async () => {
    await window.electron.auth.logout();
    setUser(null);
    setAuthState('unauthenticated');
    setCommits([]);
    setIssues([]);
    setSyncStatus({ branch: '', ahead: 0, behind: 0, modified: [], lastPull: null });
    setShowSettings(false);
    setInitState('idle');
    setInitProgress(null);
    setInitError(null);
    toast.success('Signed out');
  };

  // ── Render: loading splash ─────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-background drag-region">
        <div className="flex flex-col items-center gap-3 no-drag">
          <BrandLogo sizeClass="w-10 h-10" />
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 size={14} className="animate-spin" />
            Checking credentials\u2026
          </div>
        </div>
      </div>
    );
  }

  // ── Render: unauthenticated ───────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <Header
          user={null}
          currentPage={page}
          onNavigate={setPage}
          onLogout={handleLogout}
          onSignIn={handleLoginRequest}
        />

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="flex justify-center mb-5">
              <BrandLogo sizeClass="w-16 h-16" />
            </div>
            <h2 className="text-foreground text-lg font-semibold mb-2">Welcome to ORB Modpack Exporter</h2>
            <p className="text-muted text-sm mb-7 leading-relaxed">
              Sign in with your GitHub account to get started with modpack collaboration.
              You must be a member of the OR-Beyond organization.
            </p>
            <Button
              variant="primary"
              icon={Github}
              onClick={handleLoginRequest}
              className="px-6 py-2.5 rounded-[10px]"
            >
              Sign in with GitHub
            </Button>
          </div>
        </div>

        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />
        )}
      </div>
    );
  }

  // Whether the first-run setup screen should replace the dashboard body.
  const initActive = initState === 'cloning' || initState === 'pulling' || initState === 'error';

  // ── Render: authenticated dashboard ────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header
        user={user}
        currentPage={page}
        onNavigate={setPage}
        onLogout={handleLogout}
      />

      {page === 'home' ? (
        initActive ? (
          <InitialSetupScreen
            state={initState as 'cloning' | 'pulling' | 'error'}
            progress={initProgress}
            error={initError}
            onRetry={runInitialSetup}
          />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <ActivityFeed
              commits={commits}
              isLoading={isLoadingCommits}
              hasToken={true}
              onRefresh={handleRefreshActivity}
              limit={5}
              onViewAll={() => setPage('history')}
            />
            <Sidebar
              config={config}
              syncStatus={syncStatus}
              issues={issues}
              lastExportTime={lastExportTime}
              manifestVersion={manifestVersion}
              modrinthRelease={modrinthRelease}
              onPull={handlePull}
              onPush={() => setShowPush(true)}
              onUndoLastPush={handleUndoLastPush}
              isUndoingLastPush={isUndoingLastPush}
              onExport={() => setShowExport(true)}
              onReportBug={() =>
                config &&
                window.electron.app.openExternal(
                  `${(config.reports_repo || config.github_repo).replace('.git', '')}/issues/new`
                )
              }
              profileMode={profileMode}
              onModeChange={handleModeChange}
            />
          </div>
        )
      ) : page === 'history' ? (
        <HistoryPage
          commits={commits}
          isLoading={isLoadingCommits}
          onRefresh={handleRefreshActivity}
        />
      ) : page === 'settings' ? (
        <SettingsPage
          onBack={() => setPage('home')}
          onSaved={async () => {
            const projectId =
              (await window.electron.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';
            const [mrRes] = await Promise.all([
              window.electron.export.latestModrinthVersion(projectId).catch(() => ({ version_number: null as null })),
            ]);
            if (mrRes.version_number) setModrinthRelease(mrRes.version_number);
          }}
        />
      ) : page === 'issues' ? (
        <IssuesPage />
      ) : page === 'logs' ? (
        <LogsPage />
      ) : (
        null
      )}

      {showPush && <PushModal onClose={() => setShowPush(false)} onSuccess={handlePushSuccess} />}
      {showExport && config && (
        <ExportModal config={config} onClose={() => setShowExport(false)} onSuccess={handleExportSuccess} />
      )}
      {showSettings && (
        <SettingsModal
          showSkip
          onClose={handleSettingsSkip}
          onSaved={handleSettingsSaved}
        />
      )}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />
      )}

      <ConfirmDialog
        open={showUndoConfirm}
        title="Undo Last Push"
        description="This will revert all changes from your most recent push and update everyone."
        confirmLabel="Undo Push"
        variant="danger"
        onConfirm={() => {
          setShowUndoConfirm(false);
          void performUndoLastPush();
        }}
        onCancel={() => setShowUndoConfirm(false)}
      />

      <ConfirmDialog
        open={pendingMode !== null}
        title={pendingMode === 'prod' ? 'Switch to Production Mode?' : 'Switch to Development Mode?'}
        description={
          pendingMode === 'prod'
            ? 'Production mode exports from the production workspace and also publishes the modpack directly to Modrinth — the release goes live for all players, in addition to the normal Git flow. This is a sensitive action; every export stays tracked in History.'
            : 'Development mode exports from your development profile and only runs the normal Git flow. Nothing is published to Modrinth.'
        }
        details={
          pendingMode === 'prod' && modeConfirmInfo
            ? modeConfirmInfo.checking
              ? 'Checking latest published release…'
              : modeConfirmInfo.checkFailed
                ? "Couldn't check the latest published release (offline?)."
                : modeConfirmInfo.latestPublished
                  ? `Latest published release: v${modeConfirmInfo.latestPublished}`
                  : 'No published releases yet — this will be the first.'
            : null
        }
        confirmLabel={pendingMode === 'prod' ? 'Switch to Production' : 'Switch to Development'}
        variant={pendingMode === 'prod' ? 'warning' : 'default'}
        onConfirm={handleConfirmModeChange}
        onCancel={() => {
          setPendingMode(null);
          setModeConfirmInfo(null);
        }}
      />
      {pullResult && (
        <PullResultPopup
          addedMods={pullResult.addedMods ?? []}
          updatedMods={pullResult.updatedMods ?? []}
          removedMods={pullResult.removedMods ?? []}
          changedFiles={pullResult.changedFiles ?? []}
          onDismiss={() => setPullResult(null)}
        />
      )}

      {isAutoSyncing && (
        <div
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs z-30 select-none bg-overlay/90 text-muted-foreground border border-line/8"
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-link" />
          Syncing\u2026
        </div>
      )}

      {!modpackRootSet && !showSettings && !initActive && page === 'home' && (
        <button
          onClick={() => setPage('settings')}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium transition-colors shadow-lg z-30 bg-warning text-on-warning"
        >
          {`\u2699 Set modpack root in Settings`}
        </button>
      )}
    </div>
  );
}
