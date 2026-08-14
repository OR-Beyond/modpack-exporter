import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Package,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppConfig, ChangelogDiff, ChangelogResult } from '../../types';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../base/Modal';
import Button from '../base/Button';
import Input, { LABEL_CLASSES } from '../base/Input';
import Textarea from '../base/Textarea';
import ProgressBar from '../base/ProgressBar';
import ModStatusBadge, { type ModStatus } from '../common/ModStatusBadge';
import { bumpPatch, formatSize } from '../../utils/format';

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

const FILE_COLLAPSE_LIMIT = 5;

// ── Sub-components ────────────────────────────────────────────────────────────

function Dot({ className }: { className: string }) {
  return <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 inline-block ${className}`} />;
}

function ModList({ mods, status, dotClass, labelClass, label }: {
  mods: { name: string }[]; status: ModStatus; dotClass: string; labelClass: string; label: string;
}) {
  if (mods.length === 0) return null;
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${labelClass}`}>
        {label} ({mods.length})
      </p>
      <div className="flex flex-col gap-1">
        {mods.map(m => (
          <div key={m.name} className="flex items-center gap-2 min-w-0">
            <Dot className={dotClass} />
            <span className="text-xs truncate text-foreground/80 flex-1">{m.name}</span>
            <ModStatusBadge status={status} />
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

  const dotClass = { added: 'bg-success', removed: 'bg-brand', changed: 'bg-warning' };
  const visible = expanded ? all : all.slice(0, FILE_COLLAPSE_LIMIT);
  const hidden = all.length - FILE_COLLAPSE_LIMIT;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 text-muted-foreground">
        Changed Files ({all.length})
      </p>
      <div className="flex flex-col gap-1">
        {visible.map(({ f, status }) => (
          <div key={f} className="flex items-center gap-2 min-w-0">
            <Dot className={dotClass[status]} />
            <span className="text-xs font-mono truncate text-foreground/80">{f}</span>
          </div>
        ))}
        {!expanded && hidden > 0 && (
          <button
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity text-link"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown size={11} />+{hidden} more file{hidden !== 1 ? 's' : ''}
          </button>
        )}
        {expanded && all.length > FILE_COLLAPSE_LIMIT && (
          <button
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity text-link"
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
      <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed bg-success/10 border border-success/20 text-muted-foreground">
        Initial release — no previous version to compare.
      </div>
    );
  }

  if (result.type === 'no_changes') {
    return (
      <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed bg-warning/10 border border-warning/20 text-muted-foreground">
        No changes since last release — version was already exported.
      </div>
    );
  }

  const d = result.diff as ChangelogDiff;
  const hasAny = d.addedMods.length + d.removedMods.length + d.updatedMods.length +
    d.addedFiles.length + d.removedFiles.length + d.changedFiles.length > 0;

  if (!hasAny) {
    return (
      <div className="rounded-lg px-3 py-2.5 text-xs bg-subtle border border-line/6 text-muted-foreground">
        No changes detected since v{d.from}.
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-3 bg-subtle border border-line/6">
      {d.from && (
        <p className="text-[11px] text-muted-foreground">
          Comparing against v{d.from}
        </p>
      )}
      <ModList mods={d.addedMods}   status="added"   dotClass="bg-success" labelClass="text-success" label="Added Mods"   />
      <ModList mods={d.removedMods} status="removed" dotClass="bg-brand"   labelClass="text-brand"   label="Removed Mods" />
      <ModList mods={d.updatedMods} status="updated" dotClass="bg-warning" labelClass="text-warning" label="Updated Mods" />
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
    phase === 'success'   ? 'rgb(var(--color-success))' :
    phase === 'error'     ? 'rgb(var(--color-danger))'  :
                            'rgb(var(--color-link))';

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
    <Modal open onClose={onClose} dismissible={!isLocked} widthClass="w-[520px]">
      <ModalHeader onClose={onClose} locked={isLocked}>
        <h2 className="text-foreground font-semibold text-[15px]">
          {phase === 'changelog'
            ? `Changelog — v${version.trim()}`
            : 'Export .mrpack'}
        </h2>
      </ModalHeader>

      <ModalBody>
        {/* ── form phase ── */}
        {phase === 'form' && (
          <div className="p-5 flex flex-col gap-4">
            <div>
              <label className={LABEL_CLASSES}>Version</label>
              <Input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder={version === '' ? 'Loading…' : undefined}
                className="font-mono"
                hint={versionNote ?? undefined}
              />
            </div>

            <div>
              <label className={LABEL_CLASSES}>Output file</label>
              {outputPath ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-subtle border border-line/6">
                  <Package size={13} className="text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-xs font-mono truncate text-foreground/80" title={outputPath}>
                    {outputPath}
                  </span>
                  <button
                    onClick={handleChooseLocation}
                    className="text-xs flex-shrink-0 hover:opacity-75 transition-opacity text-link"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleChooseLocation}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors bg-subtle border border-dashed border-line/15 text-muted-foreground hover:border-link hover:text-link"
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
                <span className="text-xs font-medium text-muted-foreground">Progress</span>
                <span className="text-xs font-mono tabular-nums text-link">{progress.percent}%</span>
              </div>
              <ProgressBar percent={progress.percent} color={barColor} />
            </div>
            <p className="text-sm text-center leading-relaxed text-muted-foreground">
              {progress.message || 'Starting…'}
            </p>
          </div>
        )}

        {/* ── changelog phase ── */}
        {phase === 'changelog' && changelogResult && (
          <div className="p-5 flex flex-col gap-4">
            {/* Fallback warning: could not fetch from Modrinth */}
            {changelogResult.warning && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft/10 border border-warning-soft/25">
                <AlertCircle size={14} className="text-warning-soft mt-0.5 flex-shrink-0" />
                <p className="text-xs leading-relaxed text-warning-soft">
                  {changelogResult.warning}
                </p>
              </div>
            )}
            {/* Info note: e.g. "Mod changes since vX on Modrinth" */}
            {changelogResult.note && !changelogResult.warning && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-link/10 border border-link/20">
                <p className="text-xs leading-relaxed text-link">
                  {changelogResult.note}
                </p>
              </div>
            )}
            {/* Visual diff summary */}
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Changes detected</p>
              <DiffSummary result={changelogResult} />
            </div>

            {/* Divider */}
            <div className="border-t border-line/6" />

            {/* Editable changelog */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Changelog text</label>
                <button
                  onClick={() => setChangelogText(originalMarkdown)}
                  disabled={changelogText === originalMarkdown}
                  className="flex items-center gap-1 text-xs hover:opacity-75 transition-opacity disabled:opacity-30 text-link"
                >
                  <RotateCcw size={10} />Reset
                </button>
              </div>
              <Textarea
                value={changelogText}
                onChange={e => setChangelogText(e.target.value)}
                rows={11}
                className="text-xs font-mono"
                style={{ lineHeight: '1.6' }}
                spellCheck={false}
              />
            </div>

            {/* Snapshot-exists warning */}
            {changelogResult.snapshotExists && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft/10 border border-warning-soft/25">
                <AlertCircle size={14} className="text-warning-soft mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-1 text-warning-soft">
                    Release v{version.trim()} already has a snapshot
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwriteSnapshot}
                      onChange={e => setOverwriteSnapshot(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-warning"
                    />
                    <span className="text-xs text-muted-foreground">
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
                <span className="text-xs font-medium text-muted-foreground">Progress</span>
                <span className="text-xs font-mono tabular-nums text-link">{progress.percent}%</span>
              </div>
              <ProgressBar percent={progress.percent} color={barColor} />
            </div>
            <p className="text-sm text-center leading-relaxed text-muted-foreground">
              {progress.message || 'Starting…'}
            </p>
          </div>
        )}

        {/* ── success phase ── */}
        {phase === 'success' && (
          <div className="p-6 flex flex-col gap-5">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-success/10 border border-success/25">
                <CheckCircle2 size={24} className="text-success" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Complete</span>
                <span className="text-xs font-mono tabular-nums text-success">100%</span>
              </div>
              <ProgressBar percent={100} color="rgb(var(--color-success))" />
            </div>
            <p className="text-sm text-center text-muted-foreground">Export complete!</p>
            {fileSize !== null && (
              <div className="flex justify-center">
                <span className="text-xs px-3 py-1 rounded-full font-mono bg-success/10 text-success">
                  {formatSize(fileSize)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── error phase ── */}
        {phase === 'error' && error && (
          <div className="p-5">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25">
              <AlertCircle size={14} className="text-danger mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold mb-0.5 text-danger">Export failed</p>
                <p className="text-xs break-words leading-relaxed text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}
      </ModalBody>

      {/* ── Footer ── */}
      <ModalFooter>
        {phase === 'form' && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!version.trim() || !outputPath}
              onClick={handleGenerateChangelog}
            >
              Generate Changelog →
            </Button>
          </>
        )}

        {phase === 'generating' && (
          <span className="px-4 py-2 text-sm text-muted-foreground">Generating…</span>
        )}

        {phase === 'changelog' && (
          <>
            <Button variant="ghost" onClick={handleBack}>
              ← Back
            </Button>
            <Button variant="primary" icon={Package} onClick={handleExport}>
              Export
            </Button>
          </>
        )}

        {phase === 'exporting' && (
          <span className="px-4 py-2 text-sm text-muted-foreground">Exporting…</span>
        )}

        {phase === 'success' && (
          <>
            <Button variant="ghost" icon={FolderOpen} onClick={handleOpenFolder}>
              Open Folder
            </Button>
            <button
              onClick={onSuccess}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-success hover:bg-success/10"
            >
              Done
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" icon={Package} onClick={handleRetry}>
              Retry
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
