import Store from 'electron-store';
import path from 'path';
import os from 'os';

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
  initialSetupComplete: string;
  modrinthPath: string;
  readOnlyMode: boolean;
  autoSyncOnLaunch: boolean;
  minecraftVersion: string;
  fabricLoaderVersion: string;
}

const isSandbox = typeof __SANDBOX__ !== 'undefined' && __SANDBOX__;

export const SANDBOX_ROOT = __SANDBOX__ ? path.join(os.tmpdir(), 'orb-exporter-sandbox') : '';

export const store = new Store<StoreSchema>({
  name: isSandbox ? 'config-sandbox' : 'config',
  cwd: isSandbox ? SANDBOX_ROOT : undefined,
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
