import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, X } from 'lucide-react';
import type { PullFileChange, PullModEntry, PullModUpdate } from '../../types';

interface Props {
  addedMods: PullModEntry[];
  updatedMods: PullModUpdate[];
  removedMods: PullModEntry[];
  changedFiles: PullFileChange[];
  onDismiss: () => void;
}

const C = {
  added:   '#3fb950',
  updated: '#d2991d',
  removed: '#f85149',
  files:   '#8b949e',
  surface: '#161b22',
  border:  '#30363d',
  elevated:'#21262d',
  text:    '#c9d1d9',
  muted:   '#8b949e',
} as const;

const COLLAPSE_LIMIT = 5;

// ── Icon with lazy-load + placeholder ────────────────────────────────────────

function ModIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const letter = (name || '?')[0].toUpperCase();

  if (!iconUrl || failed) {
    return (
      <div
        className="w-10 h-10 rounded-[6px] flex-shrink-0 flex items-center justify-center text-white text-sm font-bold select-none"
        style={{ background: '#30363d' }}
      >
        {letter}
      </div>
    );
  }
  return (
    <img
      src={iconUrl}
      loading="lazy"
      alt={name}
      onError={() => setFailed(true)}
      className="w-10 h-10 rounded-[6px] flex-shrink-0 object-cover"
      style={{ background: C.elevated }}
    />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  label,
  color,
  count,
  children,
}: {
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {label} · {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ── Collapsible list ──────────────────────────────────────────────────────────

function CollapsibleList<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSE_LIMIT);
  const hidden = items.length - COLLAPSE_LIMIT;

  return (
    <>
      {visible.map((item, i) => renderItem(item, i))}
      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs transition-opacity hover:opacity-75"
          style={{ color: C.muted }}
        >
          <ChevronDown size={11} />
          Show all {items.length}
        </button>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PullResultPopup({
  addedMods,
  updatedMods,
  removedMods,
  changedFiles,
  onDismiss,
}: Props) {
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);

  // Summary line in header
  const parts: string[] = [];
  if (updatedMods.length > 0) parts.push(`${updatedMods.length} updated`);
  if (addedMods.length > 0)   parts.push(`${addedMods.length} added`);
  if (removedMods.length > 0) parts.push(`${removedMods.length} removed`);
  if (changedFiles.length > 0) parts.push(`${changedFiles.length} file${changedFiles.length !== 1 ? 's' : ''} changed`);

  const fileStatusColor = (status: PullFileChange['status']): string => {
    if (status === 'added')   return C.added;
    if (status === 'removed') return C.removed;
    return C.updated;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onMouseDown={e => setMouseDownTarget(e.target)}
      onMouseUp={e => {
        if (mouseDownTarget === e.target && e.target === e.currentTarget) onDismiss();
        setMouseDownTarget(null);
      }}
    >
      <div
        className="w-[520px] flex flex-col rounded-[12px] shadow-2xl"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          maxHeight: '70vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} style={{ color: C.added }} className="flex-shrink-0" />
            <div>
              <p className="text-white font-semibold text-[15px] leading-tight">Sync Complete</p>
              {parts.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{parts.join(' · ')}</p>
              )}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: C.muted }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Updated mods */}
          <Section label="Updated" color={C.updated} count={updatedMods.length}>
            <CollapsibleList
              items={updatedMods}
              renderItem={(mod, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <ModIcon iconUrl={mod.iconUrl} name={mod.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">{mod.name}</p>
                    {(mod.oldVersionNumber || mod.newVersionNumber) && (
                      <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: C.muted }}>
                        {mod.oldVersionNumber ?? '?'} → {mod.newVersionNumber ?? '?'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            />
          </Section>

          {/* Added mods */}
          <Section label="Added" color={C.added} count={addedMods.length}>
            <CollapsibleList
              items={addedMods}
              renderItem={(mod, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <ModIcon iconUrl={mod.iconUrl} name={mod.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">{mod.name}</p>
                    {mod.versionNumber && (
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: C.muted }}>
                        v{mod.versionNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}
            />
          </Section>

          {/* Removed mods */}
          <Section label="Removed" color={C.removed} count={removedMods.length}>
            <CollapsibleList
              items={removedMods}
              renderItem={(mod, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0 opacity-70">
                  <ModIcon iconUrl={mod.iconUrl} name={mod.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">{mod.name}</p>
                    {mod.versionNumber && (
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: C.muted }}>
                        v{mod.versionNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}
            />
          </Section>

          {/* Changed files */}
          <Section label="Files" color={C.files} count={changedFiles.length}>
            <CollapsibleList
              items={changedFiles}
              renderItem={(file, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0 py-0.5">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide"
                    style={{
                      background: `${fileStatusColor(file.status)}18`,
                      color: fileStatusColor(file.status),
                    }}
                  >
                    {file.status}
                  </span>
                  <span
                    className="text-xs font-mono truncate"
                    style={{ color: C.text }}
                    title={file.path}
                  >
                    {file.path}
                  </span>
                </div>
              )}
            />
          </Section>

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <p className="text-xs" style={{ color: C.muted }}>Click anywhere outside or press "Got it" to dismiss</p>
          <button
            onClick={onDismiss}
            className="px-4 py-1.5 rounded-[8px] text-white text-sm font-medium transition-colors"
            style={{ background: C.elevated, border: `1px solid ${C.border}` }}
            onMouseEnter={e => (e.currentTarget.style.background = '#30363d')}
            onMouseLeave={e => (e.currentTarget.style.background = C.elevated)}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
