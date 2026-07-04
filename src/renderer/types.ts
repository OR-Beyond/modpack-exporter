export interface AppConfig {
  pack_name: string;
  version: string;
  minecraft_version: string;
  fabric_loader_version: string;
  lite_pack_name: string;
  lite_version: string;
  github_repo: string;
  github_branch: string;
  modrinth_id: string;
  modrinth_url: string;
  lite_modrinth_id: string;
  lite_modrinth_url: string;
  include_folders: string[];
  include_files: string[];
  [key: string]: unknown;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface ModChange {
  type: 'added' | 'removed' | 'updated';
  name: string;
}

export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | string;
  additions: number;
  deletions: number;
}

export interface CommitModEntry {
  slug: string;
  name: string;
  iconUrl: string | null;
  versionNumber: string | null;
  oldVersionNumber?: string | null;
  status: 'added' | 'removed' | 'updated';
}

export interface CommitFileEntry {
  path: string;
  status: 'added' | 'modified' | 'removed';
  parentModSlug?: string;
  parentModName?: string;
}

export interface CommitChanges {
  mods: CommitModEntry[];
  otherFiles: CommitFileEntry[];
}

export interface CommitCard {
  sha: string;
  message: string;
  author: { login: string; avatar_url: string; html_url: string };
  date: string;
  url: string;
  modChanges: ModChange[];
  configChanged: boolean;
  files: CommitFile[];
  detailsLoaded: boolean;
  changes?: CommitChanges;
}

export interface IssueLabel {
  name: string;
  color: string; // hex without leading #
}

export interface Issue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string; avatar_url: string };
  labels: IssueLabel[];
}

export interface LauncherProfileEntry {
  name: string;
  path: string;
  modCount: number;
}

export interface LauncherProfileGroup {
  launcher: string;
  launcherIcon: string;
  profiles: LauncherProfileEntry[];
}

export interface ModpackInfo {
  config: AppConfig | null;
  exportState: { version: string; timestamp: string } | null;
}

export interface SyncStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  lastPull: string | null;
}

export interface ExportOptions {
  version: string;
  isLite: boolean;
  isRelease: boolean;
  packName: string;
  exportDir?: string;
}

export interface ExportResult {
  success: boolean;
  output_path?: string;
  mc_version?: string;
  loader_version?: string;
  stats?: { total: number; resolved: number; embedded: number };
  changes?: { added: string[]; removed: string[]; updated: string[] };
  error?: string;
}

export interface PullModEntry {
  slug: string;
  name: string;
  projectId: string | null;
  iconUrl: string | null;
  versionNumber: string | null;
  source: 'modrinth' | 'local';
}

export interface PullModUpdate {
  slug: string;
  name: string;
  projectId: string | null;
  iconUrl: string | null;
  oldVersionNumber: string | null;
  newVersionNumber: string | null;
}

export interface PullFileChange {
  path: string;
  status: 'added' | 'modified' | 'removed';
}

export interface PushRemovedMod {
  slug: string;
  name: string;
  versionNumber: string | null;
  iconUrl: string | null;
}

export interface PushResult {
  success: boolean;
  version?: number;
  modsAdded?: number;
  modsRemoved?: number;
  removedMods?: PushRemovedMod[];
  modsUnresolved?: string[];
  filesChanged?: number;
  output?: string;
  error?: string;
}

export interface PullResult {
  success: boolean;
  pulled?: boolean;
  modsDownloaded?: number;
  modsRemoved?: number;
  modsSkipped?: string[];
  filesUpdated?: number;
  filesSkipped?: string[];
  errors?: string[];
  addedMods?: PullModEntry[];
  updatedMods?: PullModUpdate[];
  removedMods?: PullModEntry[];
  changedFiles?: PullFileChange[];
  error?: string;
}

export interface ChangelogModEntry {
  path: string;
  name: string;
}

export interface ChangelogDiff {
  from: string;
  addedMods: ChangelogModEntry[];
  removedMods: ChangelogModEntry[];
  updatedMods: ChangelogModEntry[];
  addedFiles: string[];
  removedFiles: string[];
  changedFiles: string[];
}

export interface ChangelogResult {
  success: boolean;
  type: 'initial' | 'diff' | 'no_changes';
  snapshotExists: boolean;
  diff: ChangelogDiff | null;
  markdown: string;
  error?: string;
  warning?: string;
  note?: string;
}

export interface PushPreviewMod {
  slug: string;
  name: string;
  iconUrl: string | null;
  versionNumber: string | null;
  projectId: string | null;
  source: 'modrinth' | 'local';
}

export interface PushPreviewUpdate {
  slug: string;
  name: string;
  iconUrl: string | null;
  versionNumber: string | null;
  oldVersionNumber: string | null;
  projectId: string | null;
}

export interface PushPreviewResult {
  success: boolean;
  addedMods: PushPreviewMod[];
  updatedMods: PushPreviewUpdate[];
  removedMods: PushPreviewMod[];
  changedFiles: { path: string; status: 'added' | 'modified' | 'removed' }[];
  unchangedCount: number;
  isFirstPush?: boolean;
  error?: string;
}

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

export interface AuthStartResult {
  success: boolean;
  token?: string;
  user?: GitHubUser | null;
  error?: string;
}

export interface AuthCheckResult {
  success: boolean;
  authenticated: boolean;
  user?: GitHubUser;
  error?: string;
}

declare global {
  interface Window {
    electron: {
      platform: string;
      auth: {
        start: () => Promise<AuthStartResult>;
        logout: () => Promise<{ success: boolean; error?: string }>;
        check: () => Promise<AuthCheckResult>;
        onDeviceCode: (handler: (info: DeviceCodeInfo) => void) => void;
        offDeviceCode: () => void;
      };
      settings: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, val: string) => Promise<void>;
        getAll: () => Promise<Record<string, string>>;
        testWebhook: (url: string) => Promise<{ success: boolean; error?: string }>;
      };
      config: {
        read: () => Promise<{ success: boolean; data?: AppConfig; error?: string }>;
        write: (data: unknown) => Promise<{ success: boolean; error?: string }>;
        readExportState: () => Promise<{ success: boolean; data?: { version: string; timestamp: string } | null }>;
      };
      github: {
        getUser: () => Promise<{ success: boolean; data?: GitHubUser; error?: string }>;
        getCommits: (o: { owner: string; repo: string; branch: string }) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getCommitFiles: (o: { owner: string; repo: string; sha: string }) => Promise<{ success: boolean; data?: { files: CommitFile[]; modChanges: ModChange[]; configChanged: boolean }; error?: string }>;
        getIssues: (o: { owner: string; repo: string }) => Promise<{ success: boolean; data?: Issue[]; error?: string }>;
      };
      git: {
        ensureVersionsRepo: () => Promise<{ success: boolean; error?: string }>;
        pull: () => Promise<PullResult>;
        push: (o: { message: string }) => Promise<PushResult>;
        status: () => Promise<{ success: boolean; data?: SyncStatus; error?: string }>;
        stagedFiles: () => Promise<{ success: boolean; data?: string[] }>;
        commitChanges: (sha: string) => Promise<{ success: boolean; data?: CommitChanges; error?: string }>;
        pushPreview: () => Promise<PushPreviewResult>;
        undoLastPush: () => Promise<{ success: boolean; message?: string; error?: string }>;
        onSyncProgress: (handler: (data: { stage: string; message: string; percent: number }) => void) => void;
        offSyncProgress: () => void;
      };
      python: { syncMods: () => Promise<{ success: boolean; data?: any; error?: string }> };
      export: {
        run: (o: ExportOptions) => Promise<ExportResult>;
        mrpack: (o: { outputPath: string; version: string; changelog?: string; overwriteSnapshot?: boolean }) => Promise<{ success: boolean; path?: string; size?: number; error?: string }>;
        saveDialog: (opts: { defaultPath?: string }) => Promise<string | null>;
        latestModrinthVersion: (projectId: string) => Promise<{ version_number: string | null; versionId?: string; publishedAt?: string; reason?: string }>;
        manifestVersion: () => Promise<{ success: boolean; versionId: number | null; error?: string }>;
        generateChangelog: (o: { version: string }) => Promise<ChangelogResult>;
        onProgress: (handler: (data: { stage: string; message: string; percent: number }) => void) => void;
        offProgress: () => void;
      };
      modpack: {
        info: () => Promise<{ success: boolean; data?: ModpackInfo; error?: string }>;
        detectRoot: () => Promise<{ success: boolean; path: string | null }>;
        deepScan: () => Promise<{ success: boolean; path: string | null; driveRoot: string | null; error?: string }>;
        abortScan: () => Promise<{ success: boolean }>;
        listProfiles: () => Promise<{ success: boolean; data: LauncherProfileGroup[]; error?: string }>;
        setRootFromProfile: (path: string) => Promise<{ success: boolean }>;
        setRoot: (p: string) => Promise<{ success: boolean }>;
        getRoot: () => Promise<{ success: boolean; path: string | null }>;
        onRootFound: (handler: (data: { path: string }) => void) => void;
        offRootFound: () => void;
        onScanProgress: (handler: (data: { message: string }) => void) => void;
        offScanProgress: () => void;
      };
      app: {
        openExternal: (url: string) => Promise<void>;
        showInFolder: (filePath: string) => Promise<void>;
        selectDirectory: () => Promise<string | null>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        checkForUpdate: () => Promise<{ updateAvailable: boolean; version?: string; downloadUrl?: string; releaseNotes?: string }>;
        installUpdate: (downloadUrl?: string) => Promise<void>;
      };
    };
  }
}
