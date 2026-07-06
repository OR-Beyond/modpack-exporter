import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Package,
  RotateCcw,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppConfig, ChangelogDiff, ChangelogResult } from '../../types';

interface Props {
  config: AppConfig;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = 'form' | 'generating' | 'changelog' | 'exporting' | 'success' | 'error';

interface ProgressState {
  stage: string;
  message: string;
  percent: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = {
  bg:          '#0d1117',
  surface:     '#161b22',
  border:      'rgba(255,255,255,0.08)',
  divider:     'rgba(255,255,255,0.06)',
  muted:       '#8b949e',
  text:        '#c9d1d9',
  accent:      '#58a6ff',
  success:     '#3fb950',
  error:       '#f85149',
  warn:        '#e3b341',
  barBg:       '#21262d',
  green:       '#20AC64',
  red:         '#E24729',
  yellow:      '#FFA809',
  btnBlue:     '#1f6feb',
  btnBluH:     '#388bfd',
} as const;

const FILE_COLLAPSE_LIMIT = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function bumpPatch(version: string): string {
  const parts = version.replace(/-.*$/, '').split('.');
  if (parts.length >= 3) { parts[2] = String(Number(parts[2]) + 1); return parts.join('.'); }
  return version;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: COLORS.barBg, height: '6px' }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color, transition: 'width 300ms ease, background 300ms ease' }}
      />
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="w-[7px] h-[7px] rounded-full flex-shrink-0 inline-block" style={{ background: color }} />;
}

function ModList({ mods, color, label }: { mods: { name: string }[]; color: string; label: string }) {
  if (mods.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color }}>
        {label} ({mods.length})
      </p>
      <div className="flex flex-col gap-1">
        {mods.map((m, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <Dot color={color} />
            <span className="text-xs truncate" style={{ color: COLORS.text }}>{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileList({ added, removed, changed }: { added: string[]; removed: string[]; changed: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const all = [
    ...added.map(f => ({ f, status: 'added' as const })),
    ...removed.map(f => ({ f, status: 'removed' as const })),
    ...changed.map(f => ({ f, status: 'changed' as const })),
  ];
  if (all.length === 0) return null;

  const dotColor = { added: COLORS.green, removed: COLORS.red, changed: COLORS.yellow };
  const visible = expanded ? all : all.slice(0, FILE_COLLAPSE_LIMIT);
  const hidden = all.length - FILE_COLLAPSE_LIMIT;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.muted }}>
        Changed Files ({all.length})
      </p>
      <div className="flex flex-col gap-1">
        {visible.map(({ f, status }, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <Dot color={dotColor[status]} />
            <span className="text-xs font-mono truncate" style={{ color: COLORS.text }}>{f}</span>
          </div>
        ))}
        {!expanded && hidden > 0 && (
          <button
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity"
            style={{ color: COLORS.accent }}
            onClick={() => setExpanded(true)}
          >
            <ChevronDown size={11} />+{hidden} more file{hidden !== 1 ? 's' : ''}
          </button>
        )}
        {expanded && all.length > FILE_COLLAPSE_LIMIT && (
          <button
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity"
            style={{ color: COLORS.accent }}
            onClick={() => setExpanded(false)}
          >
            <ChevronUp size={11} />Show less
          </button>
        )}
      </div>
    </div>
  );
}

function DiffSummary({ result }: { result: ChangelogResult }) {
  if (result.type === 'initial') {
    return (
      <div
        className="rounded-[8px] px-3 py-2.5 text-xs leading-relaxed"
        style={{ background: 'rgba(63,185,80,0.06)', border: `1px solid rgba(63,185,80,0.2)`, color: COLORS.muted }}
      >
        Initial release — no previous version to compare.
      </div>
    );
  }

  if (result.type === 'no_changes') {
    return (
      <div
        className="rounded-[8px] px-3 py-2.5 text-xs leading-relaxed"
        style={{ background: 'rgba(255,168,9,0.06)', border: `1px solid rgba(255,168,9,0.2)`, color: COLORS.muted }}
      >
        No changes since last release — version was already exported.
      </div>
    );
  }

  const d = result.diff as ChangelogDiff;
  const hasAny = d.addedMods.length + d.removedMods.length + d.updatedMods.length +
    d.addedFiles.length + d.removedFiles.length + d.changedFiles.length > 0;

  if (!hasAny) {
    return (
      <div
        className="rounded-[8px] px-3 py-2.5 text-xs"
        style={{ background: COLORS.bg, border: `1px solid ${COLORS.divider}`, color: COLORS.muted }}
      >
        No changes detected since v{d.from}.
      </div>
    );
  }

  return (
    <div
      className="rounded-[8px] p-3 flex flex-col gap-3"
      style={{ background: COLORS.bg, border: `1px solid ${COLORS.divider}` }}
    >
      {d.from && (
        <p className="text-[11px]" style={{ color: COLORS.muted }}>
          Comparing against v{d.from}
        </p>
      )}
      <ModList mods={d.addedMods}   color={COLORS.green}  label="Added Mods"   />
      <ModList mods={d.removedMods} color={COLORS.red}    label="Removed Mods" />
      <ModList mods={d.updatedMods} color={COLORS.yellow} label="Updated Mods" />
      <FileList added={d.addedFiles} removed={d.removedFiles} changed={d.changedFiles} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExportModal({ config, onClose, onSuccess }: Props) {
  const [version, setVersion]               = useState('');
  const [versionNote, setVersionNote]       = useState<string | null>(null);
  const [outputPath, setOutputPath]         = useState<string | null>(null);
  const [phase, setPhase]                   = useState<Phase>('form');
  const [progress, setProgress]             = useState<ProgressState>({ stage: '', message: '', percent: 0 });
  const [error, setError]                   = useState<string | null>(null);
  const [fileSize, setFileSize]             = useState<number | null>(null);
  const [changelogResult, setChangelogResult] = useState<ChangelogResult | null>(null);
  const [changelogText, setChangelogText]   = useState('');
  const [originalMarkdown, setOriginalMarkdown] = useState('');
  const [overwriteSnapshot, setOverwriteSnapshot] = useState(false);

  const setProgressRef = useRef(setProgress);
  setProgressRef.current = setProgress;
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);

  // On mount: try Modrinth API first, fall back to local manifest
  useEffect(() => {
    void (async () => {
      const projectId =
        (await window.electron.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';

      const mr = await window.electron.export
        .latestModrinthVersion(projectId)
        .catch(() => ({ version_number: null as null, reason: 'Network error' }));

      if (mr.version_number) {
        setVersion(bumpPatch(mr.version_number));
        setVersionNote(null);
        return;
      }

      // Modrinth unavailable — fall back to local manifest version
      const mv = await window.electron.export.manifestVersion().catch(() => ({ success: false, versionId: null as null }));
      if (mv.success && mv.versionId !== null) {
        setVersion(String(mv.versionId + 1));
      } else {
        setVersion(bumpPatch(config.version));
      }
      setVersionNote(mr.reason ?? 'Could not fetch latest Modrinth release. Using local version.');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const packName       = config.pack_name;
  const defaultFilename = `${packName} ${version.trim() || '0.0.0'}.mrpack`;
  const isLocked       = phase === 'generating' || phase === 'exporting';

  const barColor =
    phase === 'success'   ? COLORS.success :
    phase === 'error'     ? COLORS.error   :
                            COLORS.accent;

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleChooseLocation = async () => {
    const p = await window.electron.export.saveDialog({ defaultPath: defaultFilename });
    if (p) setOutputPath(p);
  };

  const handleGenerateChangelog = async () => {
    setError(null);
    setProgress({ stage: '', message: 'Starting…', percent: 0 });
    setPhase('generating');

    window.electron.export.onProgress(({ stage, message, percent }) => {
      setProgressRef.current({ stage, message, percent });
    });

    try {
      const r = await window.electron.export.generateChangelog({ version: version.trim() });
      if (r.success) {
        setChangelogResult(r);
        setChangelogText(r.markdown);
        setOriginalMarkdown(r.markdown);
        setOverwriteSnapshot(false);
        setPhase('changelog');
      } else {
        setError(r.error ?? 'Failed to generate changelog');
        setPhase('error');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error generating changelog');
      setPhase('error');
    } finally {
      window.electron.export.offProgress();
    }
  };

  const handleExport = async () => {
    if (!outputPath || !version.trim()) return;
    setError(null);
    setProgress({ stage: '', message: 'Starting…', percent: 0 });
    setPhase('exporting');

    window.electron.export.onProgress(({ stage, message, percent }) => {
      setProgressRef.current({ stage, message, percent });
    });

    try {
      const r = await window.electron.export.mrpack({
        outputPath,
        version: version.trim(),
        changelog: changelogText,
        overwriteSnapshot,
      });
      if (r.success) {
        setFileSize(r.size ?? null);
        setPhase('success');
        toast.success(`Exported ${packName} ${version.trim()}`);
      } else {
        setError(r.error ?? 'Export failed');
        setPhase('error');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error during export');
      setPhase('error');
    } finally {
      window.electron.export.offProgress();
    }
  };

  const handleOpenFolder = () => {
    if (outputPath) window.electron.app.showInFolder(outputPath);
  };

  const handleBack = () => {
    setChangelogResult(null);
    setChangelogText('');
    setOriginalMarkdown('');
    setPhase('form');
  };

  const handleRetry = () => {
    setError(null);
    setPhase('form');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onMouseDown={e => setMouseDownTarget(e.target)}
      onMouseUp={e => {
        if (mouseDownTarget === e.target && e.target === e.currentTarget && !isLocked) onClose();
        setMouseDownTarget(null);
      }}
    >
      <div
        className="w-[520px] rounded-[14px] overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          maxHeight: 'min(90vh, 820px)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${COLORS.divider}` }}
        >
          <h2 className="text-white font-semibold text-[15px]">
            {phase === 'changelog'
              ? `Changelog — v${version.trim()}`
              : 'Export .mrpack'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLocked}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: COLORS.muted }}
            onMouseEnter={e => { if (!isLocked) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── form phase ── */}
          {phase === 'form' && (
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.muted }}>Version</label>
                <input
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder={version === '' ? 'Loading…' : undefined}
                  className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white font-mono focus:outline-none transition-colors"
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
                  onFocus={e => (e.currentTarget.style.borderColor = COLORS.accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = COLORS.border)}
                />
                {versionNote && (
                  <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: COLORS.muted }}>
                    {versionNote}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.muted }}>Output file</label>
                {outputPath ? (
                  <div
                    className="flex items-center gap-2 rounded-[8px] px-3 py-2.5"
                    style={{ background: COLORS.bg, border: `1px solid ${COLORS.divider}` }}
                  >
                    <Package size={13} style={{ color: COLORS.muted }} className="flex-shrink-0" />
                    <span className="flex-1 text-xs font-mono truncate" style={{ color: COLORS.text }} title={outputPath}>
                      {outputPath}
                    </span>
                    <button
                      onClick={handleChooseLocation}
                      className="text-xs flex-shrink-0 hover:opacity-75 transition-opacity"
                      style={{ color: COLORS.accent }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleChooseLocation}
                    className="w-full flex items-center justify-center gap-2 rounded-[8px] px-3 py-2.5 text-sm transition-colors"
                    style={{ background: COLORS.bg, border: `1px dashed rgba(255,255,255,0.15)`, color: COLORS.muted }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = COLORS.muted; }}
                  >
                    <FolderOpen size={14} />Choose location…
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── generating phase ── */}
          {phase === 'generating' && (
            <div className="p-6 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.muted }}>Progress</span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: COLORS.accent }}>{progress.percent}%</span>
                </div>
                <ProgressBar percent={progress.percent} color={barColor} />
              </div>
              <p className="text-sm text-center leading-relaxed" style={{ color: COLORS.muted }}>
                {progress.message || 'Starting…'}
              </p>
            </div>
          )}

          {/* ── changelog phase ── */}
          {phase === 'changelog' && changelogResult && (
            <div className="p-5 flex flex-col gap-4">
              {/* Fallback warning: could not fetch from Modrinth */}
              {changelogResult.warning && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-[8px]"
                  style={{ background: 'rgba(227,179,65,0.08)', border: '1px solid rgba(227,179,65,0.25)' }}
                >
                  <AlertCircle size={14} style={{ color: COLORS.warn }} className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs leading-relaxed" style={{ color: COLORS.warn }}>
                    {changelogResult.warning}
                  </p>
                </div>
              )}
              {/* Info note: e.g. "Mod changes since vX on Modrinth" */}
              {changelogResult.note && !changelogResult.warning && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-[8px]"
                  style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)' }}
                >
                  <p className="text-xs leading-relaxed" style={{ color: COLORS.accent }}>
                    {changelogResult.note}
                  </p>
                </div>
              )}
              {/* Visual diff summary */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: COLORS.muted }}>Changes detected</p>
                <DiffSummary result={changelogResult} />
              </div>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${COLORS.divider}` }} />

              {/* Editable changelog */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium" style={{ color: COLORS.muted }}>Changelog text</label>
                  <button
                    onClick={() => setChangelogText(originalMarkdown)}
                    disabled={changelogText === originalMarkdown}
                    className="flex items-center gap-1 text-xs hover:opacity-75 transition-opacity disabled:opacity-30"
                    style={{ color: COLORS.accent }}
                  >
                    <RotateCcw size={10} />Reset
                  </button>
                </div>
                <textarea
                  value={changelogText}
                  onChange={e => setChangelogText(e.target.value)}
                  rows={11}
                  className="w-full rounded-[8px] px-3 py-2.5 text-xs font-mono text-white resize-none focus:outline-none transition-colors"
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, lineHeight: '1.6' }}
                  onFocus={e => (e.currentTarget.style.borderColor = COLORS.accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = COLORS.border)}
                  spellCheck={false}
                />
              </div>

              {/* Snapshot-exists warning */}
              {changelogResult.snapshotExists && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-[8px]"
                  style={{ background: 'rgba(227,179,65,0.08)', border: '1px solid rgba(227,179,65,0.25)' }}
                >
                  <AlertCircle size={14} style={{ color: COLORS.warn }} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-1" style={{ color: COLORS.warn }}>
                      Release v{version.trim()} already has a snapshot
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwriteSnapshot}
                        onChange={e => setOverwriteSnapshot(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-amber-400"
                      />
                      <span className="text-xs" style={{ color: COLORS.muted }}>
                        Overwrite existing snapshot and changelog
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── exporting phase ── */}
          {phase === 'exporting' && (
            <div className="p-6 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.muted }}>Progress</span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: COLORS.accent }}>{progress.percent}%</span>
                </div>
                <ProgressBar percent={progress.percent} color={barColor} />
              </div>
              <p className="text-sm text-center leading-relaxed" style={{ color: COLORS.muted }}>
                {progress.message || 'Starting…'}
              </p>
            </div>
          )}

          {/* ── success phase ── */}
          {phase === 'success' && (
            <div className="p-6 flex flex-col gap-5">
              <div className="flex justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(63,185,80,0.10)', border: '1px solid rgba(63,185,80,0.25)' }}
                >
                  <CheckCircle2 size={24} style={{ color: COLORS.success }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.muted }}>Complete</span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: COLORS.success }}>100%</span>
                </div>
                <ProgressBar percent={100} color={COLORS.success} />
              </div>
              <p className="text-sm text-center" style={{ color: COLORS.muted }}>Export complete!</p>
              {fileSize !== null && (
                <div className="flex justify-center">
                  <span
                    className="text-xs px-3 py-1 rounded-full font-mono"
                    style={{ background: 'rgba(63,185,80,0.08)', color: COLORS.success }}
                  >
                    {formatSize(fileSize)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── error phase ── */}
          {phase === 'error' && error && (
            <div className="p-5">
              <div
                className="flex items-start gap-2.5 p-3 rounded-[8px]"
                style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)' }}
              >
                <AlertCircle size={14} style={{ color: COLORS.error }} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.error }}>Export failed</p>
                  <p className="text-xs break-words leading-relaxed" style={{ color: COLORS.muted }}>{error}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: `1px solid ${COLORS.divider}` }}
        >
          {phase === 'form' && (
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
                onClick={handleGenerateChangelog}
                disabled={!version.trim() || !outputPath}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: COLORS.btnBlue }}
                onMouseEnter={e => { if (version.trim() && outputPath) e.currentTarget.style.background = COLORS.btnBluH; }}
                onMouseLeave={e => (e.currentTarget.style.background = COLORS.btnBlue)}
              >
                Generate Changelog →
              </button>
            </>
          )}

          {phase === 'generating' && (
            <span className="px-4 py-2 text-sm" style={{ color: COLORS.muted }}>Generating…</span>
          )}

          {phase === 'changelog' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 rounded-[8px] text-sm transition-colors"
                style={{ color: COLORS.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                ← Back
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all"
                style={{ background: COLORS.btnBlue }}
                onMouseEnter={e => (e.currentTarget.style.background = COLORS.btnBluH)}
                onMouseLeave={e => (e.currentTarget.style.background = COLORS.btnBlue)}
              >
                <Package size={14} />Export
              </button>
            </>
          )}

          {phase === 'exporting' && (
            <span className="px-4 py-2 text-sm" style={{ color: COLORS.muted }}>Exporting…</span>
          )}

          {phase === 'success' && (
            <>
              <button
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm transition-colors"
                style={{ color: COLORS.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <FolderOpen size={14} />Open Folder
              </button>
              <button
                onClick={onSuccess}
                className="px-4 py-2 rounded-[8px] text-sm font-medium transition-colors"
                style={{ color: COLORS.success }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(63,185,80,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Done
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] text-sm transition-colors"
                style={{ color: COLORS.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Close
              </button>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all"
                style={{ background: COLORS.btnBlue }}
                onMouseEnter={e => (e.currentTarget.style.background = COLORS.btnBluH)}
                onMouseLeave={e => (e.currentTarget.style.background = COLORS.btnBlue)}
              >
                <Package size={14} />Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
