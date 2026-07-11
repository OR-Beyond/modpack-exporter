import React, { useEffect, useState } from 'react';
import { Send, Loader2, ArrowLeft, FolderOpen, Shield, History, Server, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileSelector from '../SettingsModal/ProfileSelector';
import ConfirmDialog from '../ConfirmDialog';
import { getCachedSetting, setCachedSetting } from '@/lib/utils/settingsCache';
import type { PromoteDiffEntry, ProfileMode } from '@/lib/types';

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

export default function SettingsPage({ onBack, onSaved }: Props) {
  const [modpackRoot, setModpackRoot] = useState('');
  const [exportDir, setExportDir] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [modrinthProjectId, setModrinthProjectId] = useState('O5wGsyGR');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [readOnlyEnabled, setReadOnlyEnabled] = useState(false);
  const [profileMode, setProfileMode] = useState<ProfileMode>('dev');
  const [lastSnapshotTime, setLastSnapshotTime] = useState<string | null>(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [promoteDiff, setPromoteDiff] = useState<PromoteDiffEntry[] | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [pendingSnapshotInfo, setPendingSnapshotInfo] = useState<string | null>(null);
  const [pendingPromotePreview, setPendingPromotePreview] = useState<PromoteDiffEntry[] | null | undefined>(undefined);

  useEffect(() => {
    setModpackRoot(getCachedSetting('modpackRoot'));
    setExportDir(getCachedSetting('exportDir'));
    setDiscordWebhook(getCachedSetting('discordWebhook'));
    setModrinthProjectId(getCachedSetting('modrinthProjectId') || 'O5wGsyGR');

    window.electron.settings.getReadOnly().then(setReadOnlyEnabled);
    window.electron.profile.getMode().then(setProfileMode);
    window.electron.profile.listSnapshots().then(r => {
      if (r.success && r.data && r.data.length > 0) {
        setLastSnapshotTime(r.data[r.data.length - 1].timestamp);
      }
    });
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

  const handleTakeSnapshot = async () => {
    setIsSnapshotting(true);
    const r = await window.electron.profile.snapshot();
    setIsSnapshotting(false);
    if (r.success && r.data) {
      setLastSnapshotTime(r.data.timestamp);
      toast.success('Profile snapshot saved');
    } else {
      toast.error(`Snapshot failed: ${r.error}`);
    }
  };

  const handleRestoreSnapshot = async () => {
    const snapshots = await window.electron.profile.listSnapshots();
    if (!snapshots.success || !snapshots.data || snapshots.data.length === 0) {
      toast.error('No snapshots to restore');
      return;
    }
    const latest = snapshots.data[snapshots.data.length - 1];
    setPendingSnapshotInfo(new Date(latest.timestamp).toLocaleString());
    setShowRestoreConfirm(true);
  };

  const handleConfirmRestore = async () => {
    setShowRestoreConfirm(false);
    const snapshots = await window.electron.profile.listSnapshots();
    if (!snapshots.success || !snapshots.data || snapshots.data.length === 0) return;
    const latest = snapshots.data[snapshots.data.length - 1];
    setIsRestoring(true);
    const r = await window.electron.profile.restore(latest.id);
    setIsRestoring(false);
    if (r.success) {
      toast.success('Profile restored from snapshot');
    } else {
      toast.error(`Restore failed: ${r.error}`);
    }
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
    ]);
    setIsSaving(false);
    setHasChanges(false);
    toast.success('Settings saved');
    onSaved();
  };

  const inputClass =
    'w-full rounded-[8px] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#0890FE] transition-all';
  const inputStyle = { background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' } as const;
  const labelClass = 'text-[#A9A9AB] text-xs font-medium mb-1.5 block';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Back to Home"
          >
            <ArrowLeft size={15} className="text-[#A9A9AB]" />
          </button>
          <h2 className="text-white font-semibold text-base">Settings</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#0890FE' }}
          onMouseEnter={e => { if (!isSaving) e.currentTarget.style.background = '#1a9dff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0890FE'; }}
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl flex flex-col gap-6">
          {/* Modpack Root */}
          <div>
            <label className={labelClass}>
              Modpack Root Directory <span className="text-[#E24729]">*</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Your Minecraft profile directory that contains a{' '}
              <code className="bg-white/10 px-1 rounded">mods/</code> subfolder.
            </p>
            <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
          </div>

          {/* Export Directory */}
          <div>
            <label className={labelClass}>
              Export Directory <span className="text-[#A9A9AB] font-normal">(optional)</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Where <code className="bg-white/10 px-1 rounded">.mrpack</code> files are saved.
              Defaults to <code className="bg-white/10 px-1 rounded">modpack_root/Modpack Export/</code>.
            </p>
            <div className="flex gap-2">
              <input
                value={exportDir}
                onChange={e => { setExportDir(e.target.value); setHasChanges(true); }}
                placeholder="Leave blank for default"
                className={`${inputClass} flex-1`}
                style={inputStyle}
              />
              <button
                onClick={selectExportDir}
                className="px-3 py-2 rounded-[8px] hover:bg-white/10 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                aria-label="Browse"
              >
                <FolderOpen size={15} className="text-[#A9A9AB]" />
              </button>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Read-only mode */}
          <div>
            <label className={labelClass}>
              Read-only Mode <span className="text-[#A9A9AB] font-normal">(optional)</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              When enabled, pull and push operations are blocked. Useful when you want to
              inspect your modpack without risking accidental changes.
            </p>
            <button
              onClick={handleReadOnlyToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-medium transition-all ${
                readOnlyEnabled ? 'text-[#20AC64]' : 'text-[#A9A9AB]'
              }`}
              style={{
                background: readOnlyEnabled ? 'rgba(32,172,100,0.1)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${readOnlyEnabled ? 'rgba(32,172,100,0.35)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                className="w-8 h-4 rounded-full transition-colors relative"
                style={{
                  background: readOnlyEnabled ? '#20AC64' : 'rgba(255,255,255,0.15)',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
                  style={{ left: readOnlyEnabled ? '18px' : '3px' }}
                />
              </div>
              {readOnlyEnabled ? 'Read-only is ON' : 'Read-only is OFF'}
            </button>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Profile Protection */}
          <div>
            <label className={labelClass}>
              Profile Protection <span className="text-[#A9A9AB] font-normal">(optional)</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Protect your modpack profile from accidental changes. Snapshots let you restore
              your mods, configs, and resource packs to a known state.
            </p>
            <div className="flex items-center gap-1.5 mb-2">
              <Shield size={12} className={lastSnapshotTime ? 'text-[#20AC64]' : 'text-[#A9A9AB]'} />
              <span className="text-[#A9A9AB] text-xs">
                {lastSnapshotTime ? `Snapshotted ${new Date(lastSnapshotTime).toLocaleString()}` : 'No snapshots yet'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTakeSnapshot}
                disabled={isSnapshotting}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all disabled:opacity-50"
                style={{ color: '#20AC64', border: '1px solid rgba(32,172,100,0.35)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(32,172,100,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {isSnapshotting ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
                {isSnapshotting ? 'Saving...' : 'Snapshot'}
              </button>
              <button
                onClick={handleRestoreSnapshot}
                disabled={isRestoring || !lastSnapshotTime}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all disabled:opacity-40"
                style={{ color: '#FFA809', border: '1px solid rgba(255,168,9,0.35)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,168,9,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {isRestoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
              {profileMode === 'dev' && (
                <button
                  onClick={handlePromote}
                  disabled={isPromoting}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all disabled:opacity-50"
                  style={{ color: '#0890FE', border: '1px solid rgba(8,144,254,0.35)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(8,144,254,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {isPromoting ? <Loader2 size={11} className="animate-spin" /> : <Server size={11} />}
                  {isPromoting ? 'Promoting...' : 'Promote'}
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Discord webhook */}
          <div>
            <label className={labelClass}>
              Discord Webhook <span className="text-[#A9A9AB] font-normal">(optional)</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Receive a notification in Discord after every successful push.
              Create one in your server's channel settings under Integrations.
            </p>
            <div className="flex gap-2">
              <input
                value={discordWebhook}
                onChange={e => { setDiscordWebhook(e.target.value); setHasChanges(true); }}
                placeholder="https://discord.com/api/webhooks/…"
                className={`${inputClass} flex-1`}
                style={inputStyle}
              />
              <button
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !discordWebhook.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ background: 'rgba(88,166,255,0.12)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)' }}
                onMouseEnter={e => { if (discordWebhook.trim() && !isTestingWebhook) (e.currentTarget.style.background = 'rgba(88,166,255,0.2)'); }}
                onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(88,166,255,0.12)'); }}
                title="Send a test message"
              >
                {isTestingWebhook ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isTestingWebhook ? 'Sending…' : 'Test'}
              </button>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Modrinth Project ID */}
          <div>
            <label className={labelClass}>
              Modrinth Project ID <span className="text-[#A9A9AB] font-normal">(optional)</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Used to fetch the latest published release and suggest the next version when exporting.
              Find it in your Modrinth project settings.
            </p>
            <input
              value={modrinthProjectId}
              onChange={e => { setModrinthProjectId(e.target.value); setHasChanges(true); }}
              placeholder="O5wGsyGR"
              className={inputClass}
              style={inputStyle}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showRestoreConfirm}
        title="Restore Snapshot"
        description="This will revert all profile files to the selected snapshot. Any changes made since this snapshot will be lost. It is recommended to take a fresh snapshot before restoring."
        details={pendingSnapshotInfo ? `Snapshot from ${pendingSnapshotInfo}` : null}
        confirmLabel="Restore"
        variant="warning"
        onConfirm={handleConfirmRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />

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
