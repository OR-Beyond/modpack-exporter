import { contextBridge, ipcRenderer } from 'electron';

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

const api = {
  platform: process.platform,

  // ── Auth (device flow) ────────────────────────────────────────────────────
  auth: {
    /** Starts the device flow. Resolves with { success, token?, user?, error? } once
     *  the user has approved (or the flow times out / is aborted). */
    start: () => ipcRenderer.invoke('device-auth:start'),

    /** Aborts any pending flow and clears the stored token. */
    logout: () => ipcRenderer.invoke('device-auth:logout'),

    /** Resolves with { success, authenticated, user?, error? }. */
    check: () => ipcRenderer.invoke('device-auth:check'),

    /** Subscribe to device-code events emitted during `start()`. The handler
     *  receives the user_code + verification_uri to display. Replaces any
     *  previously registered handler. */
    onDeviceCode: (handler: (info: DeviceCodeInfo) => void) => {
      ipcRenderer.removeAllListeners('device-auth:code');
      ipcRenderer.on('device-auth:code', (_event, info: DeviceCodeInfo) => handler(info));
    },

    /** Remove all device-code listeners. Call when the auth modal closes. */
    offDeviceCode: () => ipcRenderer.removeAllListeners('device-auth:code'),
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, val: string) => ipcRenderer.invoke('settings:set', key, val),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    testWebhook: (url: string) => ipcRenderer.invoke('settings:test-webhook', { url }),
    getReadOnly: () => ipcRenderer.invoke('settings:get-read-only'),
    setReadOnly: (enabled: boolean) => ipcRenderer.invoke('settings:set-read-only', { enabled }),
  },
  config: {
    read: () => ipcRenderer.invoke('config:read'),
    write: (data: unknown) => ipcRenderer.invoke('config:write', data),
    readExportState: () => ipcRenderer.invoke('config:read-export-state'),
  },
  github: {
    getUser: () => ipcRenderer.invoke('github:get-user'),
    getCommits: (o: unknown) => ipcRenderer.invoke('github:get-commits', o),
    getCommitFiles: (o: unknown) => ipcRenderer.invoke('github:get-commit-files', o),
    getIssues: (o: unknown) => ipcRenderer.invoke('github:get-issues', o),
  },
  git: {
    ensureVersionsRepo: () => ipcRenderer.invoke('git:ensure-versions-repo'),
    pull: () => ipcRenderer.invoke('git:pull'),
    push: (o: unknown) => ipcRenderer.invoke('git:push', o),
    status: () => ipcRenderer.invoke('git:status'),
    stagedFiles: () => ipcRenderer.invoke('git:staged-files'),
    commitChanges: (sha: string) => ipcRenderer.invoke('git:commit-changes', { sha }),
    pushPreview: () => ipcRenderer.invoke('git:push-preview'),
    undoLastPush: () => ipcRenderer.invoke('git:undo-last-push'),
    onSyncProgress: (handler: (data: { stage: string; message: string; percent: number }) => void) => {
      ipcRenderer.removeAllListeners('sync:progress');
      ipcRenderer.on('sync:progress', (_e, data: { stage: string; message: string; percent: number }) => handler(data));
    },
    offSyncProgress: () => ipcRenderer.removeAllListeners('sync:progress'),
  },
  python: { syncMods: () => ipcRenderer.invoke('python:sync-mods') },
  export: {
    run: (o: unknown) => ipcRenderer.invoke('export:run', o),
    mrpack: (o: unknown) => ipcRenderer.invoke('export:mrpack', o),
    saveDialog: (opts: unknown) => ipcRenderer.invoke('export:save-dialog', opts),
    latestModrinthVersion: (projectId: string) => ipcRenderer.invoke('export:latest-modrinth-version', { projectId }),
    manifestVersion: () => ipcRenderer.invoke('export:manifest-version'),
    generateChangelog: (o: unknown) => ipcRenderer.invoke('export:generate-changelog', o),
    onProgress: (handler: (data: { stage: string; message: string; percent: number }) => void) => {
      ipcRenderer.removeAllListeners('export:progress');
      ipcRenderer.on('export:progress', (_e, data: { stage: string; message: string; percent: number }) => handler(data));
    },
    offProgress: () => ipcRenderer.removeAllListeners('export:progress'),
  },
  modpack: {
    info: () => ipcRenderer.invoke('modpack:info'),
    detectRoot: () => ipcRenderer.invoke('modpack:detect-root'),
    deepScan: () => ipcRenderer.invoke('modpack:deep-scan'),
    abortScan: () => ipcRenderer.invoke('modpack:abort-scan'),
    listProfiles: () => ipcRenderer.invoke('modpack:list-profiles'),
    setRootFromProfile: (profilePath: string) => ipcRenderer.invoke('modpack:set-root-from-profile', profilePath),
    setRoot: (p: string) => ipcRenderer.invoke('modpack:set-root', p),
    getRoot: () => ipcRenderer.invoke('modpack:get-root'),
    onRootFound: (handler: (data: { path: string }) => void) => {
      ipcRenderer.removeAllListeners('modpack:root-found');
      ipcRenderer.on('modpack:root-found', (_e, data: { path: string }) => handler(data));
    },
    offRootFound: () => ipcRenderer.removeAllListeners('modpack:root-found'),
    onScanProgress: (handler: (data: { message: string }) => void) => {
      ipcRenderer.removeAllListeners('modpack:scan-progress');
      ipcRenderer.on('modpack:scan-progress', (_e, data: { message: string }) => handler(data));
    },
    offScanProgress: () => ipcRenderer.removeAllListeners('modpack:scan-progress'),
  },
  versions: {
    list: () => ipcRenderer.invoke('versions:list'),
    rollback: (versionId: string) => ipcRenderer.invoke('versions:rollback', { versionId }),
    current: () => ipcRenderer.invoke('versions:current'),
  },
  profile: {
    getMode: () => ipcRenderer.invoke('profile:get-mode'),
    setMode: (mode: string) => ipcRenderer.invoke('profile:set-mode', { mode }),
    snapshot: () => ipcRenderer.invoke('profile:snapshot'),
    listSnapshots: () => ipcRenderer.invoke('profile:list-snapshots'),
    restore: (snapshotId: string) => ipcRenderer.invoke('profile:restore', { snapshotId }),
    promote: () => ipcRenderer.invoke('profile:promote'),
    promotePreview: () => ipcRenderer.invoke('profile:promote-preview'),
  },
  modrinth: {
    getIcons: (slugs: string[]) => ipcRenderer.invoke('modrinth:get-icons', slugs),
  },
  app: {
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
    showInFolder: (filePath: string) => ipcRenderer.invoke('app:show-in-folder', filePath),
    selectDirectory: () => ipcRenderer.invoke('app:select-directory'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    maximize: () => ipcRenderer.invoke('app:maximize'),
    close: () => ipcRenderer.invoke('app:close'),
    checkForUpdate: () => ipcRenderer.invoke('app:check-for-update'),
    installUpdate: (downloadUrl?: string) => ipcRenderer.invoke('app:install-update', downloadUrl),
  },
};

contextBridge.exposeInMainWorld('electron', api);
