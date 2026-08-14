import React, { useEffect, useState } from 'react';
import {
  Send, Loader2, ArrowLeft, FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileSelector from '../SettingsModal/ProfileSelector';
import { getCachedSetting, setCachedSetting } from '@/lib/utils/settingsCache';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { THEMES } from '@/lib/theme/themes';
import Button from '../base/Button';
import Card from '../base/Card';
import Input, { LABEL_CLASSES } from '../base/Input';
import IconButton from '../base/IconButton';
import Toggle from '../base/Toggle';

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

/** Mini mock of the app shell, colored from a theme's own tokens. */
function ThemePreview({ tokens }: { tokens: Record<string, string> }) {
  const c = (k: string) => `rgb(${tokens[k]})`;
  return (
    <div
      className="flex h-16 gap-1.5 rounded-lg border p-1.5"
      style={{ background: c('--color-background'), borderColor: c('--color-line-strong') }}
    >
      <div className="flex w-1/3 flex-col gap-1 rounded-md p-1" style={{ background: c('--color-card') }}>
        <div className="h-1 w-full rounded-sm" style={{ background: c('--color-primary') }} />
        <div className="h-1 w-3/4 rounded-sm" style={{ background: c('--color-muted') }} />
        <div className="h-1 w-1/2 rounded-sm" style={{ background: c('--color-muted-foreground') }} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-1.5 w-3/4 rounded-sm" style={{ background: c('--color-foreground') }} />
        <div className="h-1 w-1/2 rounded-sm" style={{ background: c('--color-muted') }} />
        <div className="mt-auto flex gap-1">
          <div className="h-2.5 w-1/2 rounded-sm" style={{ background: c('--color-primary') }} />
          <div className="h-2.5 w-1/4 rounded-sm" style={{ background: c('--color-success') }} />
          <div className="h-2.5 w-1/4 rounded-sm" style={{ background: c('--color-warning') }} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-foreground font-semibold text-xs uppercase tracking-wide">{title}</h3>
      <p className="text-muted text-xs mt-1 leading-relaxed">{description}</p>
    </div>
  );
}

export default function SettingsPage({ onBack, onSaved }: Props) {
  const [modpackRoot, setModpackRoot] = useState('');
  const [exportDir, setExportDir] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [modrinthProjectId, setModrinthProjectId] = useState('O5wGsyGR');
  const [modrinthToken, setModrinthToken] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('1.21.1');
  const [fabricLoaderVersion, setFabricLoaderVersion] = useState('0.16.9');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [readOnlyEnabled, setReadOnlyEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setModpackRoot(getCachedSetting('modpackRoot'));
    setExportDir(getCachedSetting('exportDir'));
    setDiscordWebhook(getCachedSetting('discordWebhook'));
    setModrinthProjectId(getCachedSetting('modrinthProjectId') || 'O5wGsyGR');
    setModrinthToken(getCachedSetting('modrinthToken'));
    setMinecraftVersion(getCachedSetting('minecraftVersion') || '1.21.1');
    setFabricLoaderVersion(getCachedSetting('fabricLoaderVersion') || '0.16.9');

    window.electron.settings.getReadOnly().then(setReadOnlyEnabled);
    window.electron.settings.getAutoSyncOnLaunch().then(setAutoSyncEnabled);
  }, []);

  const handleProfileSelected = (path: string) => {
    setModpackRoot(path);
    setHasChanges(true);
  };

  const selectExportDir = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) { setExportDir(dir); setHasChanges(true); }
  };

  const handleReadOnlyToggle = async () => {
    const next = !readOnlyEnabled;
    setReadOnlyEnabled(next);
    await window.electron.settings.setReadOnly(next);
    toast(next ? 'Read-only mode enabled' : 'Read-only mode disabled');
  };

  const handleAutoSyncToggle = async () => {
    const next = !autoSyncEnabled;
    setAutoSyncEnabled(next);
    await window.electron.settings.setAutoSyncOnLaunch(next);
    toast(next ? 'Auto-sync on launch enabled' : 'Auto-sync on launch disabled');
  };

  const handleTestWebhook = async () => {
    if (!discordWebhook.trim()) { toast.error('Enter a webhook URL first'); return; }
    setIsTestingWebhook(true);
    const r = await window.electron.settings.testWebhook(discordWebhook.trim());
    setIsTestingWebhook(false);
    if (r.success) toast.success('Test message sent!');
    else toast.error(`Webhook test failed: ${r.error}`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await Promise.all([
      setCachedSetting('modpackRoot', modpackRoot.trim()),
      setCachedSetting('exportDir', exportDir.trim()),
      setCachedSetting('discordWebhook', discordWebhook.trim()),
      setCachedSetting('modrinthProjectId', modrinthProjectId.trim() || 'O5wGsyGR'),
      setCachedSetting('modrinthToken', modrinthToken.trim()),
      setCachedSetting('minecraftVersion', minecraftVersion.trim() || '1.21.1'),
      setCachedSetting('fabricLoaderVersion', fabricLoaderVersion.trim() || '0.16.9'),
    ]);
    setIsSaving(false);
    setHasChanges(false);
    toast.success('Settings saved');
    onSaved();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <IconButton icon={ArrowLeft} label="Back to Home" onClick={onBack} />
          <h2 className="text-foreground font-semibold text-base">Settings</h2>
        </div>
        <Button variant="primary" loading={isSaving} onClick={handleSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Account & Git */}
          <Card className="p-4 md:col-span-2">
            <SectionTitle
              title="Account & Git"
              description="Your modpack profile and where exported .mrpack files land."
            />
            <div className="flex flex-col gap-4">
              <div>
                <label className={LABEL_CLASSES}>
                  Modpack Root Directory <span className="text-brand">*</span>
                </label>
                <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
              </div>

              <div>
                <label className={LABEL_CLASSES}>
                  Export Directory <span className="text-muted font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={exportDir}
                      onChange={e => { setExportDir(e.target.value); setHasChanges(true); }}
                      placeholder="Leave blank for default"
                    />
                  </div>
                  <IconButton
                    icon={FolderOpen}
                    label="Browse"
                    variant="secondary"
                    sizeClass="px-3 py-2"
                    onClick={selectExportDir}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Modrinth & Publishing */}
          <Card className="p-4 md:col-span-2">
            <SectionTitle
              title="Modrinth & Publishing"
              description="Project metadata, the token used to publish releases, and the game versions written to the manifest."
            />
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASSES}>Modrinth Project ID</label>
                  <Input
                    value={modrinthProjectId}
                    onChange={e => { setModrinthProjectId(e.target.value); setHasChanges(true); }}
                    placeholder="O5wGsyGR"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASSES}>Modrinth Token</label>
                  <Input
                    type="password"
                    value={modrinthToken}
                    onChange={e => { setModrinthToken(e.target.value); setHasChanges(true); }}
                    placeholder="mrpat_…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
              <p className="text-muted text-xs -mt-2">
                Personal Access Token used to publish the modpack to Modrinth in Production mode.
                Create one in your Modrinth account settings (Authorization).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASSES}>Minecraft version</label>
                  <Input
                    value={minecraftVersion}
                    onChange={e => { setMinecraftVersion(e.target.value); setHasChanges(true); }}
                    placeholder="1.21.1"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASSES}>Fabric Loader version</label>
                  <Input
                    value={fabricLoaderVersion}
                    onChange={e => { setFabricLoaderVersion(e.target.value); setHasChanges(true); }}
                    placeholder="0.16.9"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-4">
            <SectionTitle
              title="Notifications"
              description="Discord notification after every successful push."
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={discordWebhook}
                  onChange={e => { setDiscordWebhook(e.target.value); setHasChanges(true); }}
                  placeholder="https://discord.com/api/webhooks/…"
                />
              </div>
              <button
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !discordWebhook.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 bg-link/10 text-link border border-link/25 hover:bg-link/20"
                title="Send a test message"
              >
                {isTestingWebhook ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isTestingWebhook ? 'Sending…' : 'Test'}
              </button>
            </div>
          </Card>

          {/* Advanced */}
          <Card className="p-4">
            <SectionTitle
              title="Advanced"
              description="Safety switches that change how sync behaves."
            />
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Toggle checked={readOnlyEnabled} onChange={handleReadOnlyToggle} label="Read-only mode" />
                  <span className={`text-sm font-medium ${readOnlyEnabled ? 'text-success' : 'text-muted'}`}>
                    {readOnlyEnabled ? 'Read-only is ON' : 'Read-only is OFF'}
                  </span>
                </div>
                <p className="text-muted text-[11px] mt-1.5 leading-relaxed">
                  When enabled, pull and push operations are blocked. Useful to inspect the
                  modpack without risking accidental changes.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <Toggle checked={autoSyncEnabled} onChange={handleAutoSyncToggle} label="Auto-sync on launch" />
                  <span className={`text-sm font-medium ${autoSyncEnabled ? 'text-success' : 'text-muted'}`}>
                    {autoSyncEnabled ? 'Auto-sync is ON' : 'Auto-sync is OFF'}
                  </span>
                </div>
                <p className="text-muted text-[11px] mt-1.5 leading-relaxed">
                  Automatically pulls the latest modpack after login. Off by default — auto-sync
                  can overwrite local changes you haven't pushed yet.
                </p>
              </div>
            </div>
          </Card>

          {/* Appearance */}
          <Card className="p-4 md:col-span-2">
            <SectionTitle
              title="Appearance"
              description="Pick an appearance for the whole app. Applied instantly and remembered across launches."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors ${
                    theme === t.id
                      ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-line/8 hover:bg-line/10'
                  }`}
                >
                  <ThemePreview tokens={t.tokens} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
