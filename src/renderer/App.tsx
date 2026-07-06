import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Minus, X } from 'lucide-react';

import Header from '@/lib/components/Header';
import ActivityFeed from '@/lib/components/ActivityFeed';
import Sidebar from '@/lib/components/Sidebar';
import PushModal from '@/lib/components/PushModal';
import ExportModal from '@/lib/components/ExportModal';
import SettingsModal from '@/lib/components/SettingsModal';
import LoginModal from '@/lib/components/LoginModal';
import PullResultPopup from '@/lib/components/PullResultPopup';
import InitialSetupScreen, { InitProgress } from '@/lib/components/InitialSetupScreen';

import type {
  AppConfig,
  CommitCard,
  CommitChanges,
  CommitFile,
  GitHubUser,
  Issue,
  ModChange,
  PullResult,
  SyncStatus,
} from '@/lib/types';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

// First-run initialization phases. 'idle' = already set up (normal dashboard),
// 'done' = init just finished (normal dashboard + pull popup).
type InitState = 'idle' | 'cloning' | 'pulling' | 'done' | 'error';

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export default function App() {
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

  // ── Pull result popup (manual pulls + first-run pull) ─────────────────────
  const [pullResult, setPullResult] = useState<PullResult | null>(null);

  // ── Background auto-sync state ─────────────────────────────────────────────
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // ── First-run initialization (clone versions repo + full pull) ─────────────
  const [initState, setInitState] = useState<InitState>('idle');
  const [initProgress, setInitProgress] = useState<InitProgress | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const initInFlightRef = React.useRef(false);

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
    const parsed = parseRepoUrl(cfg.github_repo);
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
                slug: mc.name.toLowerCase().replace(/\s+/g, '-'),
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
      toast.success('Modpack downloaded — you’re all set!');
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

    // Surface a hint if modpack root isn't configured yet.
    const root = await window.electron.settings.get('modpackRoot');
    setModpackRootSet(!!root);
    if (!root) {
      toast('Set your modpack root in Settings to enable git + export', { icon: '⚙️' });
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

    // Auto-sync on launch — same handler as manual pull, with index.lock retry
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
          console.warn('[auto-sync] index.lock detected, retrying in 2s…');
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
    const tid = toast.loading('Pulling latest…');
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

  const handleUndoLastPush = async () => {
    const confirmed = window.confirm(
      'Undo your last push? This will revert all changes from your most recent push and update everyone.'
    );
    if (!confirmed) return;

    setIsUndoingLastPush(true);
    const tid = toast.loading('Undoing last push…');
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
  };

  const handlePushSuccess = async () => {
    setShowPush(false);
    const [mvRes] = await Promise.all([
      window.electron.export.manifestVersion(),
      loadGitStatus(),
      ...(config ? [loadCommits(config)] : []),
    ]);
    if (mvRes.success) setManifestVersion(mvRes.versionId);
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
      <div className="flex items-center justify-center h-screen bg-[#1E1E1E] drag-region">
        <div className="flex flex-col items-center gap-3 no-drag">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #E24729 0%, #FF3F6E 100%)' }}
          >
            O
          </div>
          <div className="flex items-center gap-2 text-[#A9A9AB] text-sm">
            <Loader2 size={14} className="animate-spin" />
            Checking credentials…
          </div>
        </div>
      </div>
    );
  }

  // ── Render: unauthenticated (only SettingsModal visible) ──────────────────
  if (authState === 'unauthenticated') {
    return (
      <div className="flex flex-col h-screen bg-[#1E1E1E] overflow-hidden">
        <div
          className="h-14 drag-region flex items-center"
          style={{ paddingLeft: window.electron.platform === 'darwin' ? 2 : 20, paddingRight: 20 }}
        >
          {window.electron.platform === 'darwin' && (
            <div className="flex items-center gap-1 pl-2 pr-3 no-drag">
              <button
                onClick={() => window.electron.app.close()}
                className="w-3.5 h-3.5 rounded-full hover:brightness-75 transition-all"
                style={{ background: '#E24729' }}
                aria-label="Close"
              />
              <button
                onClick={() => window.electron.app.minimize()}
                className="w-3.5 h-3.5 rounded-full hover:brightness-75 transition-all"
                style={{ background: '#FFBD2E' }}
                aria-label="Minimize"
              />
              <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#28C840' }} aria-hidden="true" />
            </div>
          )}
          <div className="flex items-center gap-3 no-drag">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #E24729 0%, #FF3F6E 100%)' }}
            >
              O
            </div>
            <span className="font-semibold text-white text-[15px]">ORB Modpack Exporter</span>
          </div>
          {window.electron.platform !== 'darwin' && (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-0.5 no-drag">
            {window.electron.platform !== 'darwin' && (
              <>
                <button
                  onClick={() => window.electron.app.minimize()}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                  aria-label="Minimize"
                >
                  <Minus size={13} className="text-[#A9A9AB]" />
                </button>
                <button
                  onClick={() => window.electron.app.close()}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#E24729] transition-colors"
                  aria-label="Close"
                >
                  <X size={13} className="text-[#A9A9AB]" />
                </button>
              </>
            )}
          </div>
        </div>

        <SettingsModal
          dismissible={false}
          user={null}
          onClose={() => {}}
          onSaved={handleSettingsSaved}
          onRequestLogin={handleLoginRequest}
          onLogout={handleLogout}
        />

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
    <div className="flex flex-col h-screen bg-[#1E1E1E] overflow-hidden">
      <Header
        user={user}
        onExport={() => setShowExport(true)}
        onSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
      />

      {initActive ? (
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
            onReportBug={() =>
              config &&
              window.electron.app.openExternal(`${config.github_repo.replace('.git', '')}/issues/new`)
            }
          />
        </div>
      )}

      {showPush && <PushModal onClose={() => setShowPush(false)} onSuccess={handlePushSuccess} />}
      {showExport && config && (
        <ExportModal config={config} onClose={() => setShowExport(false)} onSuccess={handleExportSuccess} />
      )}
      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onSaved={handleSettingsSaved}
          onRequestLogin={handleLoginRequest}
          onLogout={handleLogout}
        />
      )}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />
      )}
      {pullResult && (
        <PullResultPopup
          addedMods={pullResult.addedMods ?? []}
          updatedMods={pullResult.updatedMods ?? []}
          removedMods={pullResult.removedMods ?? []}
          changedFiles={pullResult.changedFiles ?? []}
          onDismiss={() => setPullResult(null)}
        />
      )}

      {/* Auto-sync status indicator */}
      {isAutoSyncing && (
        <div
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs z-30 select-none"
          style={{ background: 'rgba(30,30,30,0.9)', color: '#8b949e', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#58a6ff' }} />
          Syncing…
        </div>
      )}

      {/* Hint indicator at bottom if modpackRoot still unset */}
      {!modpackRootSet && !showSettings && !initActive && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium transition-colors shadow-lg z-30"
          style={{ background: '#FFA809', color: '#1E1E1E' }}
        >
          ⚙ Set modpack root in Settings
        </button>
      )}
    </div>
  );
}
