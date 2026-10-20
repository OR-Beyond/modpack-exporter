/**
 * Single typed IPC client.
 *
 * The preload script exposes `window.electron` (typed in `lib/types`). This
 * module is the one place the renderer touches it: components import `ipc`
 * instead of reaching for the global, so the surface stays typed and the
 * event subscriptions are wrapped into plain unsubscribe functions.
 */

import type {
  AuthStartResult,
  AuthCheckResult,
  DeviceCodeInfo,
  AppConfig,
  GitHubUser,
  CommitFile,
  ModChange,
  Issue,
  IssueLabel,
  PullResult,
  PushResult,
  SyncStatus,
  CommitChanges,
  PushPreviewResult,
  ExportOptions,
  ExportResult,
  ChangelogResult,
  ModpackInfo,
  LauncherProfileGroup,
  ModIconResult,
  DefaultOptionsState,
  DefaultFileType,
  DefaultImportResult,
  LogEntry,
  ProfileMode,
  PromoteDiffEntry,
} from './types';

type ProgressHandler = (data: { stage: string; message: string; percent: number }) => void;

/** Subscribe to an event channel and return an unsubscribe function. */
function subscribe<T>(on: (handler: (data: T) => void) => void, off: () => void, handler: (data: T) => void): () => void {
  on(handler);
  return () => off();
}

export const ipc = {
  platform: window.electron.platform,

  auth: {
    start: (): Promise<AuthStartResult> => window.electron.auth.start(),
    logout: (): Promise<{ success: boolean; error?: string }> => window.electron.auth.logout(),
    check: (): Promise<AuthCheckResult> => window.electron.auth.check(),
    onDeviceCode: (handler: (info: DeviceCodeInfo) => void): (() => void) =>
      subscribe(window.electron.auth.onDeviceCode, window.electron.auth.offDeviceCode, handler),
  },

  settings: {
    get: (key: string): Promise<string | null> => window.electron.settings.get(key),
    set: (key: string, val: string): Promise<void> => window.electron.settings.set(key, val),
    getAll: (): Promise<Record<string, string>> => window.electron.settings.getAll(),
    testWebhook: (url: string): Promise<{ success: boolean; error?: string }> =>
      window.electron.settings.testWebhook(url),
    getReadOnly: (): Promise<boolean> => window.electron.settings.getReadOnly(),
    setReadOnly: (enabled: boolean): Promise<void> => window.electron.settings.setReadOnly(enabled),
    getAutoSyncOnLaunch: (): Promise<boolean> => window.electron.settings.getAutoSyncOnLaunch(),
    setAutoSyncOnLaunch: (enabled: boolean): Promise<void> =>
      window.electron.settings.setAutoSyncOnLaunch(enabled),
  },

  config: {
    read: (): Promise<{ success: boolean; data?: AppConfig; error?: string }> =>
      window.electron.config.read(),
    write: (data: unknown): Promise<{ success: boolean; error?: string }> =>
      window.electron.config.write(data),
    readExportState: (): Promise<{ success: boolean; data?: { version: string; timestamp: string } | null }> =>
      window.electron.config.readExportState(),
  },

  github: {
    getUser: (): Promise<{ success: boolean; data?: GitHubUser; error?: string }> =>
      window.electron.github.getUser(),
    getCommits: (o: { owner: string; repo: string; branch: string }): Promise<{ success: boolean; data?: any[]; error?: string }> =>
      window.electron.github.getCommits(o),
    getCommitFiles: (o: { owner: string; repo: string; sha: string }): Promise<{ success: boolean; data?: { files: CommitFile[]; modChanges: ModChange[]; configChanged: boolean }; error?: string }> =>
      window.electron.github.getCommitFiles(o),
    getIssues: (o: {
      owner: string;
      repo: string;
      state?: 'open' | 'closed' | 'all';
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      per_page?: number;
    }): Promise<{ success: boolean; data?: Issue[]; error?: string }> => window.electron.github.getIssues(o),
    getLabels: (o: { owner: string; repo: string }): Promise<{ success: boolean; data?: IssueLabel[]; error?: string }> =>
      window.electron.github.getLabels(o),
  },

  git: {
    ensureVersionsRepo: (): Promise<{ success: boolean; error?: string }> =>
      window.electron.git.ensureVersionsRepo(),
    pull: (profile?: { profileId?: string; profilePath?: string }): Promise<PullResult> => window.electron.git.pull(profile),
    push: (o: { message: string; profile?: { profileId?: string; profilePath?: string } }): Promise<PushResult> => window.electron.git.push(o),
    status: (): Promise<{ success: boolean; data?: SyncStatus; error?: string }> => window.electron.git.status(),
    stagedFiles: (): Promise<{ success: boolean; data?: string[] }> => window.electron.git.stagedFiles(),
    commitChanges: (sha: string): Promise<{ success: boolean; data?: CommitChanges; error?: string }> =>
      window.electron.git.commitChanges(sha),
    pushPreview: (): Promise<PushPreviewResult> => window.electron.git.pushPreview(),
    undoLastPush: (): Promise<{ success: boolean; message?: string; error?: string }> =>
      window.electron.git.undoLastPush(),
    onSyncProgress: (handler: ProgressHandler): (() => void) =>
      subscribe(window.electron.git.onSyncProgress, window.electron.git.offSyncProgress, handler),
  },

  export: {
    run: (o: ExportOptions): Promise<ExportResult> => window.electron.export.run(o),
    mrpack: (o: {
      outputPath: string;
      version: string;
      changelog?: string;
      overwriteSnapshot?: boolean;
      includeFancyMenu?: boolean;
      includeDefaultOptions?: boolean;
    }): Promise<{ success: boolean; path?: string; size?: number; published?: boolean; publishedVersionId?: string; error?: string }> =>
      window.electron.export.mrpack(o),
    saveDialog: (opts: { defaultPath?: string }): Promise<string | null> =>
      window.electron.export.saveDialog(opts),
    latestModrinthVersion: (projectId: string): Promise<{ version_number: string | null; versionId?: string; publishedAt?: string; reason?: string }> =>
      window.electron.export.latestModrinthVersion(projectId),
    manifestVersion: (): Promise<{ success: boolean; versionId: number | null; error?: string }> =>
      window.electron.export.manifestVersion(),
    generateChangelog: (o: { version: string }): Promise<ChangelogResult> =>
      window.electron.export.generateChangelog(o),
    onProgress: (handler: ProgressHandler): (() => void) =>
      subscribe(window.electron.export.onProgress, window.electron.export.offProgress, handler),
  },

  modpack: {
    info: (): Promise<{ success: boolean; data?: ModpackInfo; error?: string }> => window.electron.modpack.info(),
    detectRoot: (): Promise<{ success: boolean; path: string | null }> => window.electron.modpack.detectRoot(),
    deepScan: (): Promise<{ success: boolean; path: string | null; driveRoot: string | null; error?: string }> =>
      window.electron.modpack.deepScan(),
    abortScan: (): Promise<{ success: boolean }> => window.electron.modpack.abortScan(),
    listProfiles: (): Promise<{ success: boolean; data: LauncherProfileGroup[]; error?: string }> =>
      window.electron.modpack.listProfiles(),
    setRootFromProfile: (path: string): Promise<{ success: boolean }> =>
      window.electron.modpack.setRootFromProfile(path),
    setRoot: (p: string): Promise<{ success: boolean }> => window.electron.modpack.setRoot(p),
    getRoot: (): Promise<{ success: boolean; path: string | null }> => window.electron.modpack.getRoot(),
    onRootFound: (handler: (data: { path: string }) => void): (() => void) =>
      subscribe(window.electron.modpack.onRootFound, window.electron.modpack.offRootFound, handler),
    onScanProgress: (handler: (data: { message: string }) => void): (() => void) =>
      subscribe(window.electron.modpack.onScanProgress, window.electron.modpack.offScanProgress, handler),
  },

  modrinth: {
    getIcons: (slugs: string[]): Promise<Record<string, ModIconResult>> => window.electron.modrinth.getIcons(slugs),
  },

  defaults: {
    getState: (): Promise<DefaultOptionsState> => window.electron.defaults.getState(),
    import: (fileType: DefaultFileType): Promise<DefaultImportResult> => window.electron.defaults.import(fileType),
  },

  logs: {
    get: (): Promise<{ success: boolean; data?: LogEntry[]; error?: string }> => window.electron.logs.get(),
    clear: (): Promise<{ success: boolean; error?: string }> => window.electron.logs.clear(),
    onEntry: (handler: (entry: LogEntry) => void): (() => void) =>
      subscribe(window.electron.logs.onEntry, window.electron.logs.offEntry, handler),
  },

  profile: {
    getMode: (): Promise<ProfileMode> => window.electron.profile.getMode(),
    setMode: (mode: ProfileMode): Promise<{ success: boolean; error?: string }> => window.electron.profile.setMode(mode),
    promote: (): Promise<{ success: boolean; copiedMods?: number; copiedFiles?: number; error?: string }> =>
      window.electron.profile.promote(),
    promotePreview: (): Promise<{ success: boolean; data?: PromoteDiffEntry[]; error?: string }> =>
      window.electron.profile.promotePreview(),
  },

  app: {
    openExternal: (url: string): Promise<void> => window.electron.app.openExternal(url),
    showInFolder: (filePath: string): Promise<void> => window.electron.app.showInFolder(filePath),
    selectDirectory: (): Promise<string | null> => window.electron.app.selectDirectory(),
    minimize: (): Promise<void> => window.electron.app.minimize(),
    maximize: (): Promise<void> => window.electron.app.maximize(),
    close: (): Promise<void> => window.electron.app.close(),
    checkForUpdate: (): Promise<{ updateAvailable: boolean; version?: string; downloadUrl?: string; releaseNotes?: string }> =>
      window.electron.app.checkForUpdate(),
    installUpdate: (downloadUrl?: string): Promise<void> => window.electron.app.installUpdate(downloadUrl),
  },
};
