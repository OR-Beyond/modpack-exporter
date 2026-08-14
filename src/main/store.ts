import Store from 'electron-store';

export interface StoreSchema {
  githubToken: string;
  modpackRoot: string;
  exportDir: string;
  lastPullTime: string;
  lastExportTime: string;
  lastScanDriveRoot: string;
  discordWebhook: string;
  modrinthProjectId: string;
  modrinthToken: string;
  /** Set to 'true' once the versions repo has been cloned AND the first full pull
   *  has completed. Gates the first-run initialization flow so it retries on the
   *  next launch if the user quits mid-setup. */
  initialSetupComplete: string;
  /** Optional custom Modrinth App data folder (parent of profiles/), for portable
   *  or non-default installs the fixed %APPDATA%/ModrinthApp scan won't find. */
  modrinthPath: string;
  /** When true, push and pull operations are blocked to prevent accidental profile changes. */
  readOnlyMode: boolean;
  /** When true, a pull runs automatically after login on every launch. Defaults to false
   *  (opt-in) since auto-sync can silently overwrite local changes the user hasn't pushed yet. */
  autoSyncOnLaunch: boolean;
  /** Minecraft version written to modrinth.index.json's "dependencies" field. */
  minecraftVersion: string;
  /** Fabric Loader version written to modrinth.index.json's "dependencies" field. */
  fabricLoaderVersion: string;
}

export const store = new Store<StoreSchema>({
  defaults: {
    githubToken: '',
    modpackRoot: '',
    exportDir: '',
    lastPullTime: '',
    lastExportTime: '',
    lastScanDriveRoot: '',
    discordWebhook: '',
    modrinthProjectId: 'O5wGsyGR',
    modrinthToken: '',
    initialSetupComplete: '',
    modrinthPath: '',
    readOnlyMode: false,
    autoSyncOnLaunch: false,
    minecraftVersion: '1.21.1',
    fabricLoaderVersion: '0.16.9',
  },
});
