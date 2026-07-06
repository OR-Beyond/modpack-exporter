import React, { useEffect, useState } from 'react';
import { X, FolderOpen, Loader2, Github, Check, LogOut, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GitHubUser } from '../../types';
import ProfileSelector from './ProfileSelector';

interface Props {
  /** When false, the X button and overlay-click dismiss are hidden (used for first-run / unauthenticated state). */
  dismissible?: boolean;
  /** Current GitHub user, if already signed in. */
  user: GitHubUser | null;
  /** Closes the modal. */
  onClose: () => void;
  /** Called after Save. The parent should refresh state. */
  onSaved: () => void;
  /** Called when the user clicks "Login with GitHub". Parent shows LoginModal. */
  onRequestLogin: () => void;
  /** Called when the user clicks "Log out". */
  onLogout: () => void;
}

export default function SettingsModal({
  dismissible = true,
  user,
  onClose,
  onSaved,
  onRequestLogin,
  onLogout,
}: Props) {
  const [modpackRoot, setModpackRoot] = useState('');
  const [exportDir, setExportDir] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [modrinthProjectId, setModrinthProjectId] = useState('O5wGsyGR');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);
  const authenticated = !!user;

  useEffect(() => {
    (async () => {
      const all = await window.electron.settings.getAll();
      if (all.exportDir) setExportDir(all.exportDir);
      if (all.modpackRoot) setModpackRoot(all.modpackRoot);
      if (all.discordWebhook) setDiscordWebhook(all.discordWebhook);
      if (all.modrinthProjectId) setModrinthProjectId(all.modrinthProjectId);
    })();

    // If the background startup scan finishes while the modal is open, reflect it
    window.electron.modpack.onRootFound(({ path: p }) => {
      setModpackRoot(prev => prev || p);
    });
    return () => window.electron.modpack.offRootFound();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile selection ──────────────────────────────────────────────────────
  const handleProfileSelected = (path: string, profileName?: string) => {
    setModpackRoot(path);
    toast.success(profileName ? `Profile "${profileName}" selected` : `Modpack root set to ${path}`);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const selectExportDir = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) setExportDir(dir);
  };

  const handleSave = async () => {
    if (!authenticated) {
      toast.error('Sign in with GitHub before saving');
      return;
    }
    if (!modpackRoot.trim()) {
      toast.error('Modpack root is required');
      return;
    }
    setIsSaving(true);
    await Promise.all([
      window.electron.settings.set('modpackRoot', modpackRoot.trim()),
      window.electron.settings.set('exportDir', exportDir.trim()),
      window.electron.settings.set('discordWebhook', discordWebhook.trim()),
      window.electron.settings.set('modrinthProjectId', modrinthProjectId.trim() || 'O5wGsyGR'),
    ]);
    setIsSaving(false);
    toast.success('Settings saved');
    onSaved();
  };

  const handleTestWebhook = async () => {
    if (!discordWebhook.trim()) { toast.error('Enter a webhook URL first'); return; }
    setIsTestingWebhook(true);
    const r = await window.electron.settings.testWebhook(discordWebhook.trim());
    setIsTestingWebhook(false);
    if (r.success) toast.success('Test message sent!');
    else toast.error(`Webhook test failed: ${r.error}`);
  };

  // ── Styling shortcuts ──────────────────────────────────────────────────────
  const inputClass =
    'w-full rounded-[8px] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#0890FE] transition-all';
  const inputStyle = { background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' } as const;
  const labelClass = 'text-[#A9A9AB] text-xs font-medium mb-1.5 block';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onMouseDown={e => setMouseDownTarget(e.target)}
      onMouseUp={e => {
        if (dismissible && mouseDownTarget === e.target && e.target === e.currentTarget) onClose();
        setMouseDownTarget(null);
      }}
    >
      <div className="w-[500px] rounded-[12px] overflow-hidden shadow-2xl flex flex-col" style={{ background: '#323234', maxHeight: 'min(92vh, 760px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-semibold text-base">
            {dismissible ? 'Settings' : 'Welcome to ORB Modpack Exporter'}
          </h2>
          {dismissible && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={15} className="text-[#A9A9AB]" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-5 overflow-y-auto flex-1">
          {/* GitHub auth section */}
          <div>
            <label className={labelClass}>GitHub Account</label>
            {authenticated ? (
              <div
                className="flex items-center justify-between rounded-[8px] px-3 py-2.5"
                style={inputStyle}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-7 h-7 rounded-full flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Check size={12} style={{ color: '#20AC64' }} />
                      <span className="text-white text-sm font-medium truncate">{user.login}</span>
                    </div>
                    <p className="text-[#A9A9AB] text-xs">Signed in via device flow</p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors hover:bg-white/10"
                  style={{ color: '#A9A9AB', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <LogOut size={12} />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={onRequestLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[8px] text-white text-sm font-medium transition-all"
                style={{ background: '#0890FE' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
              >
                <Github size={15} />
                Sign in with GitHub
              </button>
            )}
            <p className="text-[#A9A9AB] text-xs mt-1.5">
              Required to fetch commits, issues, and push changes.
            </p>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Modpack root */}
          <div>
            <label className={labelClass}>
              Modpack Root Directory <span className="text-[#E24729]">*</span>
            </label>
            <p className="text-[#A9A9AB] text-xs mb-2">
              Detected from every major launcher on this machine (must contain a{' '}
              <code className="bg-white/10 px-1 rounded">mods/</code> subfolder), or pick one manually.
            </p>
            <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
          </div>

          {/* Export dir */}
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
                onChange={e => setExportDir(e.target.value)}
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
                onChange={e => setDiscordWebhook(e.target.value)}
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
              onChange={e => setModrinthProjectId(e.target.value)}
              placeholder="O5wGsyGR"
              className={inputClass}
              style={inputStyle}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
          {dismissible && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[8px] text-[#A9A9AB] text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !authenticated || !modpackRoot.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#0890FE' }}
            onMouseEnter={e => { if (!isSaving) e.currentTarget.style.background = '#1a9dff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0890FE'; }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSaving ? 'Saving…' : authenticated ? 'Save & Continue' : 'Sign in to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
