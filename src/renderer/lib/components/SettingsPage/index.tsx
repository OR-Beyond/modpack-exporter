import React, { useEffect, useState } from 'react';
import {
  Send, Loader2, ArrowLeft, FolderOpen, Server,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileSelector from '../SettingsModal/ProfileSelector';
import ConfirmDialog from '../ConfirmDialog';
import { getCachedSetting, setCachedSetting } from '@/lib/utils/settingsCache';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { THEMES } from '@/lib/theme/themes';
import type { PromoteDiffEntry, ProfileMode } from '@/lib/types';
import Button from '../base/Button';
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

export default function SettingsPage({ onBack, onSaved }: Props) {
  const [modpackRoot, setModpackRoot] = useState('');
  const [exportDir, setExportDir] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [modrinthProjectId, setModrinthProjectId] = useState('O5wGsyGR');
  const [minecraftVersion, setMinecraftVersion] = useState('1.21.1');
  const [fabricLoaderVersion, setFabricLoaderVersion] = useState('0.16.9');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [readOnlyEnabled, setReadOnlyEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [profileMode, setProfileMode] = useState<ProfileMode>('dev');
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteDiff, setPromoteDiff] = useState<PromoteDiffEntry[] | null>(null);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [pendingPromotePreview, setPendingPromotePreview] = useState<PromoteDiffEntry[] | null | undefined>(undefined);

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setModpackRoot(getCachedSetting('modpackRoot'));
    setExportDir(getCachedSetting('exportDir'));
    setDiscordWebhook(getCachedSetting('discordWebhook'));
    setModrinthProjectId(getCachedSetting('modrinthProjectId') || 'O5wGsyGR');
    setMinecraftVersion(getCachedSetting('minecraftVersion') || '1.21.1');
    setFabricLoaderVersion(getCachedSetting('fabricLoaderVersion') || '0.16.9');

    window.electron.settings.getReadOnly().then(setReadOnlyEnabled);
    window.electron.settings.getAutoSyncOnLaunch().then(setAutoSyncEnabled);
    window.electron.profile.getMode().then(setProfileMode);
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

  const handlePromote = async () => {
    const preview = await window.electron.profile.promotePreview();
    if (preview.success && preview.data && preview.data.length > 0) {
      setPromoteDiff(preview.data);
      setPendingPromotePreview(preview.data);
    } else {
      setPendingPromotePreview(null);
    }
    setShowPromoteConfirm(true);
  };

  const handleConfirmPromote = async () => {
    setShowPromoteConfirm(false);
    setPromoteDiff(null);
    setPendingPromotePreview(undefined);

    setIsPromoting(true);
    const r = await window.electron.profile.promote();
    setIsPromoting(false);
    if (r.success) {
      toast.success(`Promoted: ${r.copiedMods} mods, ${r.copiedFiles} files`);
      setProfileMode('prod');
    } else {
      toast.error(`Promote failed: ${r.error}`);
    }
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
        <div className="max-w-xl flex flex-col gap-6">
          {/* Modpack Root */}
          <div>
            <label className={LABEL_CLASSES}>
              Modpack Root Directory <span className="text-brand">*</span>
            </label>
            <p className="text-muted text-xs mb-2">
              Your Minecraft profile directory that contains a{' '}
              <code className="bg-line/10 px-1 rounded">mods/</code> subfolder.
            </p>
            <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
          </div>

          {/* Export Directory */}
          <div>
            <label className={LABEL_CLASSES}>
              Export Directory <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              Where <code className="bg-line/10 px-1 rounded">.mrpack</code> files are saved.
              Defaults to <code className="bg-line/10 px-1 rounded">modpack_root/Modpack Export/</code>.
            </p>
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

          <div className="h-px bg-line/6" />

          {/* Read-only mode */}
          <div>
            <label className={LABEL_CLASSES}>
              Read-only Mode <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              When enabled, pull and push operations are blocked. Useful when you want to
              inspect your modpack without risking accidental changes.
            </p>
            <div className="flex items-center gap-3">
              <Toggle checked={readOnlyEnabled} onChange={handleReadOnlyToggle} label="Read-only mode" />
              <span className={`text-sm font-medium ${readOnlyEnabled ? 'text-success' : 'text-muted'}`}>
                {readOnlyEnabled ? 'Read-only is ON' : 'Read-only is OFF'}
              </span>
            </div>
          </div>

          <div className="h-px bg-line/6" />

          {/* Auto-sync on launch */}
          <div>
            <label className={LABEL_CLASSES}>
              Auto-sync on Launch <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              When enabled, the app automatically pulls the latest modpack after you log in.
              Off by default — auto-sync can overwrite local changes you haven't pushed yet,
              so use <span className="text-foreground/80">Pull Latest</span> manually unless you're sure.
            </p>
            <div className="flex items-center gap-3">
              <Toggle checked={autoSyncEnabled} onChange={handleAutoSyncToggle} label="Auto-sync on launch" />
              <span className={`text-sm font-medium ${autoSyncEnabled ? 'text-success' : 'text-muted'}`}>
                {autoSyncEnabled ? 'Auto-sync is ON' : 'Auto-sync is OFF'}
              </span>
            </div>
          </div>

          <div className="h-px bg-line/6" />

          {/* Production workspace */}
          <div>
            <label className={LABEL_CLASSES}>
              Production Workspace <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              Copies your mods, configs, and override files from the development profile to
              the production workspace. Team members pulling from production receive these changes.
            </p>
            <div className="flex gap-2">
              {profileMode === 'dev' && (
                <Button
                  variant="soft"
                  size="sm"
                  icon={Server}
                  loading={isPromoting}
                  onClick={handlePromote}
                >
                  {isPromoting ? 'Promoting...' : 'Promote'}
                </Button>
              )}
            </div>
          </div>

          <div className="h-px bg-line/6" />

          {/* Discord webhook */}
          <div>
            <label className={LABEL_CLASSES}>
              Discord Webhook <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              Receive a notification in Discord after every successful push.
              Create one in your server's channel settings under Integrations.
            </p>
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
          </div>

          <div className="h-px bg-line/6" />

          {/* Modrinth Project ID */}
          <div>
            <label className={LABEL_CLASSES}>
              Modrinth Project ID <span className="text-muted font-normal">(optional)</span>
            </label>
            <p className="text-muted text-xs mb-2">
              Used to fetch the latest published release and suggest the next version when exporting.
              Find it in your Modrinth project settings.
            </p>
            <Input
              value={modrinthProjectId}
              onChange={e => { setModrinthProjectId(e.target.value); setHasChanges(true); }}
              placeholder="O5wGsyGR"
              spellCheck={false}
            />
          </div>

          <div className="h-px bg-line/6" />

          {/* Minecraft / Fabric Loader versions */}
          <div>
            <label className={LABEL_CLASSES}>
              Minecraft &amp; Fabric Loader Versions
            </label>
            <p className="text-muted text-xs mb-2">
              Written to the exported <code className="bg-line/10 px-1 rounded">modrinth.index.json</code>'s{' '}
              <code className="bg-line/10 px-1 rounded">dependencies</code> field, required by the Modrinth App.
              Update these when the modpack upgrades Minecraft or Fabric.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Minecraft version"
                  value={minecraftVersion}
                  onChange={e => { setMinecraftVersion(e.target.value); setHasChanges(true); }}
                  placeholder="1.21.1"
                  spellCheck={false}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Fabric Loader version"
                  value={fabricLoaderVersion}
                  onChange={e => { setFabricLoaderVersion(e.target.value); setHasChanges(true); }}
                  placeholder="0.16.9"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-line/6" />

          {/* Theme */}
          <div>
            <label className={LABEL_CLASSES}>Theme</label>
            <p className="text-muted text-xs mb-2">
              Pick an appearance for the whole app. Applied instantly and remembered across launches.
            </p>
            <div className="grid grid-cols-2 gap-2">
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
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showPromoteConfirm}
        title="Promote to Production"
        description={
          pendingPromotePreview && pendingPromotePreview.length > 0
            ? `This will copy ${pendingPromotePreview.length} change${pendingPromotePreview.length !== 1 ? 's' : ''} from your development profile to the production workspace. Team members pulling from production will receive these changes.`
            : 'This will copy all mods, configs, and override files from your development profile to the production workspace. Team members pulling from production will receive these changes.'
        }
        details={
          pendingPromotePreview && pendingPromotePreview.length > 0
            ? pendingPromotePreview.map(d =>
                `  ${d.type === 'modAdded' ? '+' : d.type === 'modRemoved' ? '-' : '~'} ${d.name}`
              ).join('\n')
            : null
        }
        confirmLabel="Promote"
        variant="warning"
        onConfirm={handleConfirmPromote}
        onCancel={() => {
          setShowPromoteConfirm(false);
          setPromoteDiff(null);
          setPendingPromotePreview(undefined);
        }}
      />
    </div>
  );
}
