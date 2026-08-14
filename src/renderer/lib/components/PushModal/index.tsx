import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PushedCommit, PushPreviewMod, PushPreviewResult, PushPreviewUpdate } from '../../types';
import Modal, { ModalHeader, ModalFooter } from '../base/Modal';
import Button from '../base/Button';
import Textarea from '../base/Textarea';
import ProgressBar from '../base/ProgressBar';
import ModIcon from '../common/ModIcon';
import ModStatusBadge from '../common/ModStatusBadge';

interface Props {
  onClose: () => void;
  onSuccess: (commit?: PushedCommit) => void;
}

type Phase = 'idle' | 'confirming' | 'pushing' | 'success' | 'error';

interface ProgressState {
  percent: number;
  message: string;
  stage: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title, colorClass, count,
}: {
  title: string; colorClass: string; count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorClass}`} />
      <span className={`text-xs font-semibold ${colorClass}`}>{title}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

function AddedModRow({ mod }: { mod: PushPreviewMod }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
      <span className="text-xs text-foreground truncate flex-1">{mod.name}</span>
      {mod.versionNumber && (
        <span className="text-xs font-mono flex-shrink-0 text-success">
          {mod.versionNumber}
        </span>
      )}
      <ModStatusBadge status="added" />
    </div>
  );
}

function UpdatedModRow({ mod }: { mod: PushPreviewUpdate }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
      <span className="text-xs text-foreground truncate flex-1">{mod.name}</span>
      <div className="flex items-center gap-1 font-mono text-xs flex-shrink-0">
        {mod.oldVersionNumber && (
          <>
            <span className="text-muted-foreground">{mod.oldVersionNumber}</span>
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <span className="text-warning-soft">{mod.versionNumber ?? '?'}</span>
      </div>
      <ModStatusBadge status="updated" versionNumber={mod.versionNumber} oldVersionNumber={mod.oldVersionNumber} />
    </div>
  );
}

function RemovedModRow({ mod }: { mod: PushPreviewMod }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
      <span className="text-xs text-foreground truncate flex-1">{mod.name}</span>
      {mod.versionNumber && (
        <span className="text-xs font-mono flex-shrink-0 text-danger">
          {mod.versionNumber}
        </span>
      )}
      <ModStatusBadge status="removed" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PushModal({ onClose, onSuccess }: Props) {
  const [commitMessage, setCommitMessage] = useState('');
  const [phase, setPhase]     = useState<Phase>('idle');
  const [progress, setProgress] = useState<ProgressState>({ percent: 0, message: '', stage: '' });
  const [error, setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(2);
  const [preview, setPreview] = useState<PushPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(false);

  const setProgressRef = useRef(setProgress);
  setProgressRef.current = setProgress;
  const pushedCommitRef = useRef<PushedCommit | undefined>(undefined);

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
        if (c <= 1) { clearInterval(interval); onSuccess(pushedCommitRef.current); return 0; }
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
        pushedCommitRef.current = r.commit;
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
    phase === 'error'   ? 'rgb(var(--color-danger))' :
    phase === 'success' ? 'rgb(var(--color-success))' :
                          'rgb(var(--color-link))';

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
        <div className="flex items-center gap-2.5 p-3.5 text-muted-foreground">
          <Loader2 size={13} className="animate-spin flex-shrink-0" />
          <span className="text-xs">Scanning for changes…</span>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="p-3.5">
          <span className="text-xs text-muted-foreground">Could not load preview</span>
        </div>
      );
    }

    if (!hasChanges) {
      return (
        <div className="flex items-center gap-2.5 p-3.5">
          <CheckCircle2 size={13} className="text-success flex-shrink-0" />
          <span className="text-xs text-muted-foreground">No changes to push — everything is in sync</span>
        </div>
      );
    }

    const { addedMods, updatedMods, removedMods, changedFiles, unchangedCount } = preview;

    return (
      <div className="flex flex-col gap-4 p-3">
        {/* Added mods */}
        {addedMods.length > 0 && (
          <div>
            <SectionHeader title="Added Mods" colorClass="text-success bg-success" count={addedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {addedMods.map(mod => <AddedModRow key={mod.slug} mod={mod} />)}
            </div>
          </div>
        )}

        {/* Updated mods */}
        {updatedMods.length > 0 && (
          <div>
            <SectionHeader title="Updated Mods" colorClass="text-warning-soft bg-warning-soft" count={updatedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {updatedMods.map(mod => <UpdatedModRow key={mod.slug} mod={mod} />)}
            </div>
          </div>
        )}

        {/* Removed mods */}
        {removedMods.length > 0 && (
          <div>
            <SectionHeader title="Removed Mods" colorClass="text-danger bg-danger" count={removedMods.length} />
            <div className="flex flex-col gap-1.5 pl-3.5">
              {removedMods.map(mod => <RemovedModRow key={mod.slug} mod={mod} />)}
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
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Changed Files</span>
              <span className="text-xs text-muted-foreground">({changedFiles.length})</span>
              <ChevronRight
                size={11}
                className={`ml-auto flex-shrink-0 transition-transform duration-200 text-muted-foreground ${filesExpanded ? 'rotate-90' : ''}`}
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
                  {changedFiles.map(f => (
                    <div key={f.path} className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-1 h-1 rounded-full flex-shrink-0 ${
                          f.status === 'added'   ? 'bg-success' :
                          f.status === 'removed' ? 'bg-danger'   :
                                                    'bg-warning-soft'
                        }`}
                      />
                      <span className="text-xs font-mono truncate text-muted-foreground">{f.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unchanged count */}
        {unchangedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {unchangedCount} mod{unchangedCount !== 1 ? 's' : ''} unchanged
          </p>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal open onClose={onClose} dismissible={phase === 'idle'} widthClass="w-[480px]">
      <ModalHeader onClose={onClose} locked={isPushing}>
        <div>
          <h2 className="text-foreground font-semibold text-[15px]">Push Changes</h2>
          <p className="text-xs mt-0.5 text-muted-foreground">Review and confirm changes before pushing</p>
        </div>
      </ModalHeader>

      {/* Body: idle / error */}
      {(phase === 'idle' || phase === 'error') && (
        <div className="p-5 flex flex-col gap-4">
          {/* Preview panel */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">
              Preview
            </label>
            <div className="rounded-lg max-h-[260px] overflow-y-auto bg-subtle border border-line/6">
              {renderPreview()}
            </div>
          </div>

          {/* Commit message */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">
              Commit message <span className="text-danger">*</span>
            </label>
            <Textarea
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              placeholder="Describe what changed…"
              rows={3}
              style={phase === 'error' ? { borderColor: 'rgb(var(--color-danger) / 0.35)' } : undefined}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRequestPush(); }}
            />
          </div>

          {/* Error banner */}
          {phase === 'error' && error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25">
              <AlertCircle size={14} className="text-danger mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold mb-0.5 text-danger">Push failed</p>
                <p className="text-xs break-words leading-relaxed text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Body: pushing / success */}
      {isActive && (
        <div className="p-6 flex flex-col gap-5">
          {phase === 'success' && (
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-success/10 border border-success/25">
                <CheckCircle2 size={24} className="text-success" />
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {phase === 'success' ? 'Complete' : 'Progress'}
              </span>
              <span className={`text-xs font-mono tabular-nums ${phase === 'success' ? 'text-success' : 'text-link'}`}>
                {progress.percent}%
              </span>
            </div>
            <ProgressBar percent={progress.percent} color={barColor} />
          </div>
          <p className="text-sm text-center leading-relaxed text-muted-foreground">
            {progress.message || 'Starting…'}
          </p>
          {phase === 'success' && (
            <p className="text-xs text-center text-muted-foreground">
              Closing in {countdown}s…
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <ModalFooter>
        {phase === 'idle' && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="success"
              icon={Upload}
              disabled={!commitMessage.trim()}
              onClick={handleRequestPush}
            >
              Push
            </Button>
          </>
        )}

        {phase === 'confirming' && (
          <>
            <div className="flex-1">
              <p className="text-xs leading-relaxed text-muted-foreground">
                This will commit <strong className="text-foreground">{commitMessage.trim()}</strong> and push
                <strong className="text-foreground">
                  {' '}{hasChanges
                    ? ` ${preview!.addedMods.length + preview!.updatedMods.length + preview!.removedMods.length + preview!.changedFiles.length} change${preview!.addedMods.length + preview!.updatedMods.length + preview!.removedMods.length + preview!.changedFiles.length !== 1 ? 's' : ''}`
                    : ' all changes'}
                </strong> to the remote repository.
                All team members will see these changes after the next pull.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPhase('idle')}>
              Go back
            </Button>
            <Button variant="success" icon={Upload} onClick={handleConfirmPush}>
              Confirm & Push
            </Button>
          </>
        )}

        {phase === 'pushing' && (
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Pushing…
          </span>
        )}

        {phase === 'success' && (
          <button
            onClick={() => onSuccess(pushedCommitRef.current)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-success hover:bg-success/10"
          >
            Done
          </button>
        )}

        {phase === 'error' && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
