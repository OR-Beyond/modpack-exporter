import React, { useEffect, useState } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileSelector from './ProfileSelector';
import { getCachedSetting, setCachedSetting } from '@/lib/utils/settingsCache';

interface Props {
  /** When false, the close button and overlay-click dismiss are hidden. */
  dismissible?: boolean;
  /** Closes the modal. */
  onClose: () => void;
  /** Called after Save. The parent should refresh state. */
  onSaved: () => void;
  /** If true, show a "Skip" button that closes without saving. */
  showSkip?: boolean;
}

export default function SettingsModal({
  dismissible = true,
  onClose,
  onSaved,
  showSkip = false,
}: Props) {
  const [modpackRoot, setModpackRoot] = useState('');
  const [exportDir, setExportDir] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);

  useEffect(() => {
    setExportDir(getCachedSetting('exportDir'));
    setModpackRoot(getCachedSetting('modpackRoot'));

    window.electron.modpack.onRootFound(({ path: p }) => {
      setModpackRoot(prev => prev || p);
    });
    return () => window.electron.modpack.offRootFound();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProfileSelected = (path: string, profileName?: string) => {
    setModpackRoot(path);
    toast.success(profileName ? `Profile "${profileName}" selected` : `Modpack root set to ${path}`);
  };

  const selectExportDir = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) setExportDir(dir);
  };

  const handleSave = async () => {
    if (!modpackRoot.trim()) {
      toast.error('Modpack root is required');
      return;
    }
    setIsSaving(true);
    await Promise.all([
      setCachedSetting('modpackRoot', modpackRoot.trim()),
      setCachedSetting('exportDir', exportDir.trim()),
    ]);
    setIsSaving(false);
    toast.success('Settings saved');
    onSaved();
  };

  const handleSkip = () => {
    toast('You can configure this later in Settings', { icon: '\u2699\uFE0F' });
    onClose();
  };

  const inputClass =
    'w-full rounded-[8px] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#0890FE] transition-all';
  const inputStyle = { background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' } as const;
  const labelClass = 'text-[#A9A9AB] text-xs font-medium mb-1.5 block';

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-semibold text-base">Welcome to ORB Modpack Exporter</h2>
          {dismissible && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={15} className="text-[#A9A9AB]" />
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-5 overflow-y-auto flex-1">
          
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
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06]">
          <div>
            {showSkip && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-[8px] text-[#A9A9AB] text-sm hover:bg-white/10 transition-colors"
              >
                Skip, I'll configure later
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {dismissible && !showSkip && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] text-[#A9A9AB] text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !modpackRoot.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0890FE' }}
              onMouseEnter={e => { if (!isSaving) e.currentTarget.style.background = '#1a9dff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0890FE'; }}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
