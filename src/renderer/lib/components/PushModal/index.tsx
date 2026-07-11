import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PushPreviewMod, PushPreviewResult, PushPreviewUpdate } from '../../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = 'idle' | 'confirming' | 'pushing' | 'success' | 'error';

interface ProgressState {
  percent: number;
  message: string;
  stage: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:            '#0d1117',
  surface:       '#323234',
  border:        'rgba(255,255,255,0.08)',
  divider:       'rgba(255,255,255,0.06)',
  muted:         '#8b949e',
  accent:        '#58a6ff',
  success:       '#3fb950',
  warning:       '#d2991d',
  error:         '#f85149',
  barBg:         '#21262d',
  btnGreen:      '#238636',
  btnGreenHover: '#2ea043',
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: COLORS.barBg, height: '6px' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: color,
          transition: 'width 300ms ease, background 300ms ease',
        }}
      />
    </div>
  );
}

function ModIcon({ name, iconUrl, size = 22 }: { name: string; iconUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  if (!iconUrl || imgError) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-[4px] font-bold"
        style={{
          width: size, height: size,
          background: '#1c2128',
          border: '1px solid rgba(255,255,255,0.12)',
          color: COLORS.muted,
          fontSize: Math.round(size * 0.45),
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={iconUrl}
      alt={name}
      className="flex-shrink-0 rounded-[4px] object-cover"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  );
}

function SectionHeader({
  title, color, count,
}: {
  title: string; color: string; count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-semibold" style={{ color }}>{title}</span>
      <span className="text-xs" style={{ color: COLORS.muted }}>({count})</span>
    </div>
  );
}

function AddedModRow({ mod }: { mod: PushPreviewMod }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} />
      <span className="text-xs text-white truncate flex-1">{mod.name}</span>
      {mod.versionNumber && (
        <span className="text-xs font-mono flex-shrink-0" style={{ color: COLORS.success }}>
          {mod.versionNumber}
        </span>
      )}
    </div>
  );
}

function UpdatedModRow({ mod }: { mod: PushPreviewUpdate }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} />
      <span className="text-xs text-white truncate flex-1">{mod.name}</span>
      <div className="flex items-center gap-1 font-mono text-xs flex-shrink-0">
        {mod.oldVersionNumber && (
          <>
            <span style={{ color: COLORS.muted }}>{mod.oldVersionNumber}</span>
            <span style={{ color: COLORS.muted }}>→</span>
          </>
        )}
        <span style={{ color: COLORS.warning }}>{mod.versionNumber ?? '?'}</span>
      </div>
    </div>
  );
}

function RemovedModRow({ mod }: { mod: PushPreviewMod }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} />
      <span className="text-xs text-white truncate flex-1">{mod.name}</span>
      {mod.versionNumber && (
        <span className="text-xs font-mono flex-shrink-0" style={{ color: COLORS.error }}>
          {mod.versionNumber}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PushModal({ onClose, onSuccess }: Props) {
  const [commitMessage, setCommitMessage] = useState('');
  const [phase, setPhase]     = useState<Phase>('idle');
  const [progress, setProgress] = useState<ProgressState>({ percent: 0, message: '', stage: '' });
  const [error, setError]     = useState<string | null>(null);
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);
  const [countdown, setCountdown] = useState(2);
  const [preview, setPreview] = useState<PushPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(false);

  const setProgressRef = useRef(setProgress);
  setProgressRef.current = setProgress;

  // Load preview on mount
  useEffect(() => {
    window.electron.git.pushPreview().then(r => {
      setPreview(r.success ? r : null);
      setPreviewLoading(false);
    }).catch(() => setPreviewLoading(false));
  }, []);

  // Auto-close 2s after success
  useEffect(() => {
    if (phase !== 'success') return;
    setCountdown(2);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); onSuccess(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, onSuccess]);

  const handleRequestPush = () => {
    if (!commitMessage.trim()) { toast.error('Commit message required'); return; }
    setPhase('confirming');
  };

  const handleConfirmPush = async () => {
    setError(null);
    setProgress({ percent: 0, message: 'Starting…', stage: '' });
    setPhase('pushing');
    window.electron.git.onSyncProgress(data => {
      setProgressRef.current({ percent: data.percent ?? 0, message: data.message ?? '', stage: data.stage ?? '' });
    });
    try {
      const r = await window.electron.git.push({ message: commitMessage.trim() });
      if (r.success) {
        setProgress({ percent: 100, message: 'Push complete!', stage: 'done' });
        setPhase('success');
        toast.success('Changes pushed successfully');
      } else {
        setError(r.error ?? 'Push failed');
        setPhase('error');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error');
      setPhase('error');
    } finally {
      window.electron.git.offSyncProgress();
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isPushing = phase === 'pushing';
  const isActive  = phase === 'pushing' || phase === 'success';
  const barColor  =
    phase === 'error'   ? COLORS.error   :
    phase === 'success' ? COLORS.success  :
                          COLORS.accent;

  const hasChanges = preview && (
    preview.addedMods.length > 0 ||
    preview.updatedMods.length > 0 ||
    preview.removedMods.length > 0 ||
    preview.changedFiles.length > 0
  );

  // ── Preview panel ──────────────────────────────────────────────────────────

  const renderPreview = () => {
    if (previewLoading) {
      return (
        <div className="flex items-center gap-2.5 p-3.5" style={{ color: COLORS.muted }}>
          <Loader2 size={13} className="animate-spin flex-shrink-0" />
          <span className="text-xs">Scanning for changes…</span>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="p-3.5">
          <span className="text-xs" style={{ color: COLORS.muted }}>Could not load preview</span>
        </div>
      );
    }

    if (!hasChanges) {
      return (
        <div className="flex items-center gap-2.5 p-3.5">
          <CheckCircle2 size={13} style={{ color: COLORS.success }} className="flex-shrink-0" />
          <span className="text-xs" style={{ color: COLORS.muted }}>No changes to push — everything is in sync</span>
        </div>
      );
    }

    const { addedMods, updatedMods, removedMods, changedFiles, unchangedCount } = preview;

    return (
      <div className="flex flex-col gap-4 p-3">
        {/* Added mods */}
        {addedMods.length > 0 && (
          <div>
            <SectionHeader title="Added Mods" color={COLORS.success} count={addedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {addedMods.map((mod, i) => <AddedModRow key={i} mod={mod} />)}
            </div>
          </div>
        )}

        {/* Updated mods */}
        {updatedMods.length > 0 && (
          <div>
            <SectionHeader title="Updated Mods" color={COLORS.warning} count={updatedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {updatedMods.map((mod, i) => <UpdatedModRow key={i} mod={mod} />)}
            </div>
          </div>
        )}

        {/* Removed mods */}
        {removedMods.length > 0 && (
          <div>
            <SectionHeader title="Removed Mods" color={COLORS.error} count={removedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {removedMods.map((mod, i) => <RemovedModRow key={i} mod={mod} />)}
            </div>
          </div>
        )}

        {/* Changed files — collapsible */}
        {changedFiles.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 w-full mb-2 hover:opacity-75 transition-opacity"
              onClick={() => setFilesExpanded(x => !x)}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLORS.muted }} />
              <span className="text-xs font-semibold" style={{ color: COLORS.muted }}>Changed Files</span>
              <span className="text-xs" style={{ color: COLORS.muted }}>({changedFiles.length})</span>
              <ChevronRight
                size={11}
                className="ml-auto flex-shrink-0 transition-transform duration-200"
                style={{ color: COLORS.muted, transform: filesExpanded ? 'rotate(90deg)' : 'none' }}
              />
            </button>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: filesExpanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 200ms ease',
              }}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pl-3.5 pb-0.5">
                  {changedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-1 h-1 rounded-full flex-shrink-0"
                        style={{
                          background:
                            f.status === 'added'   ? COLORS.success :
                            f.status === 'removed' ? COLORS.error   :
                                                     COLORS.warning,
                        }}
                      />
                      <span className="text-xs font-mono truncate" style={{ color: COLORS.muted }}>{f.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unchanged count */}
        {unchangedCount > 0 && (
          <p className="text-xs" style={{ color: COLORS.muted }}>
            {unchangedCount} mod{unchangedCount !== 1 ? 's' : ''} unchanged
          </p>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onMouseDown={e => setMouseDownTarget(e.target)}
      onMouseUp={e => {
        if (mouseDownTarget === e.target && e.target === e.currentTarget && phase === 'idle') onClose();
        setMouseDownTarget(null);
      }}
    >
      <div
        className="w-[480px] rounded-[14px] overflow-hidden shadow-2xl"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${COLORS.divider}` }}
        >
          <div>
            <h2 className="text-white font-semibold text-[15px]">Push Changes</h2>
            <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>Review and confirm changes before pushing</p>
          </div>
          <button
            onClick={onClose}
            disabled={isPushing}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
            style={{ color: COLORS.muted }}
            onMouseEnter={e => { if (!isPushing) (e.currentTarget.style.background = 'rgba(255,255,255,0.08)'); }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body: idle / error ── */}
        {(phase === 'idle' || phase === 'error') && (
          <div className="p-5 flex flex-col gap-4">
            {/* Preview panel */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.muted }}>
                Preview
              </label>
              <div
                className="rounded-[8px] max-h-[260px] overflow-y-auto"
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.divider}` }}
              >
                {renderPreview()}
              </div>
            </div>

            {/* Commit message */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.muted }}>
                Commit message <span style={{ color: COLORS.error }}>*</span>
              </label>
              <textarea
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Describe what changed…"
                rows={3}
                className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white resize-none focus:outline-none transition-colors"
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${phase === 'error' ? 'rgba(248,81,73,0.35)' : COLORS.border}`,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = COLORS.accent)}
                onBlur={e => (e.currentTarget.style.borderColor =
                  phase === 'error' ? 'rgba(248,81,73,0.35)' : COLORS.border)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRequestPush(); }}
              />
            </div>

            {/* Error banner */}
            {phase === 'error' && error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-[8px]"
                style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)' }}
              >
                <AlertCircle size={14} style={{ color: COLORS.error }} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.error }}>Push failed</p>
                  <p className="text-xs break-words leading-relaxed" style={{ color: COLORS.muted }}>{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Body: pushing / success ── */}
        {isActive && (
          <div className="p-6 flex flex-col gap-5">
            {phase === 'success' && (
              <div className="flex justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(63,185,80,0.10)', border: '1px solid rgba(63,185,80,0.25)' }}
                >
                  <CheckCircle2 size={24} style={{ color: COLORS.success }} />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: COLORS.muted }}>
                  {phase === 'success' ? 'Complete' : 'Progress'}
                </span>
                <span
                  className="text-xs font-mono tabular-nums"
                  style={{ color: phase === 'success' ? COLORS.success : COLORS.accent }}
                >
                  {progress.percent}%
                </span>
              </div>
              <ProgressBar percent={progress.percent} color={barColor} />
            </div>
            <p className="text-sm text-center leading-relaxed" style={{ color: COLORS.muted }}>
              {progress.message || 'Starting…'}
            </p>
            {phase === 'success' && (
              <p className="text-xs text-center" style={{ color: COLORS.muted }}>
                Closing in {countdown}s…
              </p>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: `1px solid ${COLORS.divider}` }}
        >
          {phase === 'idle' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] text-sm transition-colors"
                style={{ color: COLORS.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPush}
                disabled={!commitMessage.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: COLORS.btnGreen }}
                onMouseEnter={e => { if (commitMessage.trim()) e.currentTarget.style.background = COLORS.btnGreenHover; }}
                onMouseLeave={e => (e.currentTarget.style.background = COLORS.btnGreen)}
              >
                <Upload size={14} />
                Push
              </button>
            </>
          )}

          {phase === 'confirming' && (
            <>
              <div className="flex-1">
                <p className="text-xs leading-relaxed" style={{ color: COLORS.muted }}>
                  This will commit <strong style={{ color: '#fff' }}>{commitMessage.trim()}</strong> and push
                  <strong style={{ color: '#fff' }}>
                    {' '}{hasChanges
                      ? ` ${preview!.addedMods.length + preview!.updatedMods.length + preview!.removedMods.length + preview!.changedFiles.length} change${preview!.addedMods.length + preview!.updatedMods.length + preview!.removedMods.length + preview!.changedFiles.length !== 1 ? 's' : ''}`
                      : ' all changes'}
                  </strong> to the remote repository.
                  All team members will see these changes after the next pull.
                </p>
              </div>
              <button
                onClick={() => setPhase('idle')}
                className="px-3 py-2 rounded-[8px] text-sm transition-colors flex-shrink-0"
                style={{ color: COLORS.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Go back
              </button>
              <button
                onClick={handleConfirmPush}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all flex-shrink-0"
                style={{ background: COLORS.btnGreen }}
                onMouseEnter={e => (e.currentTarget.style.background = COLORS.btnGreenHover)}
                onMouseLeave={e => (e.currentTarget.style.background = COLORS.btnGreen)}
              >
                <Upload size={14} />
                Confirm & Push
              </button>
            </>
          )}

          {phase === 'pushing' && (
            <span className="px-4 py-2 text-sm" style={{ color: COLORS.muted }}>
              Pushing…
            </span>
          )}

          {phase === 'success' && (
            <button
              onClick={onSuccess}
              className="px-4 py-2 rounded-[8px] text-sm font-medium transition-colors"
              style={{ color: COLORS.success }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(63,185,80,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Done
            </button>
          )}

          {phase === 'error' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[8px] text-sm transition-colors"
              style={{ color: COLORS.muted }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
