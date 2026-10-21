interface SettingsMap {
  discordWebhook: string;
  modrinthProjectId: string;
  modpackRoot: string;
  exportDir: string;
  readOnlyMode: string;
  minecraftVersion: string;
  fabricLoaderVersion: string;
  [key: string]: string;
}

let cache: SettingsMap = {
  discordWebhook: '',
  modrinthProjectId: 'O5wGsyGR',
  modpackRoot: '',
  exportDir: '',
  readOnlyMode: '',
  minecraftVersion: '1.21.1',
  fabricLoaderVersion: '0.16.9',
};
let ready = false;

export async function initSettingsCache(): Promise<void> {
  try {
    const all = await window.electron.settings.getAll();
    if (all) {
      cache = { ...cache, ...all };
    }
    ready = true;
  } catch {
    ready = true;
  }
}

export function getCachedSetting(key: string): string {
  return cache[key] ?? '';
}

export async function setCachedSetting(key: string, value: string): Promise<void> {
  cache[key] = value;
  await window.electron.settings.set(key, value);
}

function isSettingsCacheReady(): boolean {
  return ready;
}
