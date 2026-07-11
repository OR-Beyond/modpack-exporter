interface SettingsMap {
  discordWebhook: string;
  modrinthProjectId: string;
  modpackRoot: string;
  exportDir: string;
  readOnlyMode: string;
  [key: string]: string;
}

let cache: SettingsMap = {
  discordWebhook: '',
  modrinthProjectId: 'O5wGsyGR',
  modpackRoot: '',
  exportDir: '',
  readOnlyMode: '',
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

export function isSettingsCacheReady(): boolean {
  return ready;
}
