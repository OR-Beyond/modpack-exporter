import React, { useRef, useState } from 'react';
import {
  Box, ChevronDown, ChevronRight, Code, ExternalLink,
  File, Image, Loader2, Settings,
} from 'lucide-react';
import type { CommitCard, CommitChanges, CommitFileEntry, CommitModEntry } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\//);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

// 28×28 icon for the expanded mod list
function ModIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!iconUrl || failed) {
    return (
      <div
        className="w-7 h-7 flex items-center justify-center rounded-[6px] flex-shrink-0 font-bold text-xs text-white"
        style={{ background: '#21262d' }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={iconUrl}
      alt={name}
      className="w-7 h-7 rounded-[6px] flex-shrink-0 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

// 24×24 icon for the collapsed summary row
function SmallModIcon({ mod }: { mod: CommitModEntry }) {
  const [failed, setFailed] = useState(false);
  const ringColor = mod.status === 'added' ? '#3fb95066'
    : mod.status === 'removed' ? '#f8514966'
    : '#d2991d66';

  if (!mod.iconUrl || failed) {
    return (
      <div
        title={mod.name}
        className="flex items-center justify-center flex-shrink-0 font-bold text-white"
        style={{ width: 24, height: 24, borderRadius: 4, background: '#21262d', fontSize: 10, border: `2px solid ${ringColor}` }}
      >
        {mod.name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={mod.iconUrl}
      alt={mod.name}
      title={mod.name}
      style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: `2px solid ${ringColor}` }}
      onError={() => setFailed(true)}
    />
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'added' ? '#3fb950'
    : status === 'removed' ? '#f85149'
    : '#d2991d';
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />;
}

function ModStatusBadge({ status, versionNumber, oldVersionNumber }: {
  status: CommitModEntry['status'];
  versionNumber: string | null;
  oldVersionNumber?: string | null;
}) {
  if (status === 'added') {
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ background: 'rgba(63,185,80,0.15)', color: '#3fb950' }}
      >
        Added
      </span>
    );
  }
  if (status === 'removed') {
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149' }}
      >
        Removed
      </span>
    );
  }
  if (oldVersionNumber && versionNumber && oldVersionNumber !== versionNumber) {
    return (
      <span className="text-xs flex-shrink-0" style={{ color: '#8b949e' }}>
        {oldVersionNumber} → {versionNumber}
      </span>
    );
  }
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: 'rgba(210,153,29,0.15)', color: '#d2991d' }}
    >
      Updated
    </span>
  );
}

function FileTypeIcon({ filepath }: { filepath: string }) {
  let Icon = File;
  if (filepath.startsWith('overrides/config/') || filepath === 'config.yaml') Icon = Settings;
  else if (filepath.startsWith('overrides/resourcepacks/')) Icon = Image;
  else if (filepath.startsWith('overrides/shaderpacks/')) Icon = Box;
  else if (filepath.startsWith('overrides/scripts/')) Icon = Code;
  return <Icon size={12} style={{ color: '#8b949e' }} className="flex-shrink-0" />;
}

function ConfigFileRow({ file }: { file: CommitFileEntry }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <StatusDot status={file.status} />
      <span className="text-xs font-mono truncate flex-1" style={{ color: '#8b949e' }}>
        {file.path}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MAX_SUMMARY_ICONS = 5;

interface Props { commit: CommitCard }

export default function ActivityCard({ commit }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set());
  const [localChanges, setLocalChanges] = useState<CommitChanges | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const fetchAttempted = useRef(false);

  const changes: CommitChanges | null = commit.changes ?? localChanges;
  const isLoaded = commit.detailsLoaded || localChanges !== null;

  const triggerLoad = async () => {
    if (fetchAttempted.current || commit.detailsLoaded) return;
    fetchAttempted.current = true;
    const parsed = parseOwnerRepo(commit.url);
    if (!parsed) return;
    setFetchLoading(true);
    try {
      const [changesRes, filesRes] = await Promise.all([
        window.electron.git.commitChanges(commit.sha),
        window.electron.github.getCommitFiles({ ...parsed, sha: commit.sha }),
      ]);

      if (changesRes.success && changesRes.data &&
          (changesRes.data.mods.length > 0 || changesRes.data.otherFiles.length > 0)) {
        setLocalChanges(changesRes.data);
      } else if (filesRes.success && filesRes.data) {
        setLocalChanges({
          mods: filesRes.data.modChanges.map(mc => ({
            slug: mc.name.toLowerCase().replace(/\s+/g, '-'),
            name: mc.name,
            iconUrl: null,
            versionNumber: null,
            status: mc.type,
          })),
          otherFiles: filesRes.data.files.map(f => ({
            path: f.path,
            status: f.status as 'added' | 'modified' | 'removed',
          })),
        });
      } else {
        setLocalChanges({ mods: [], otherFiles: [] });
      }
    } catch {
      setLocalChanges({ mods: [], otherFiles: [] });
    }
    setFetchLoading(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-noclick]')) return;
    setIsExpanded(prev => !prev);
    triggerLoad();
  };

  const toggleMod = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMods(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  // Build config groups
  const configsByMod = new Map<string, CommitFileEntry[]>();
  if (changes) {
    for (const file of changes.otherFiles) {
      if (file.parentModSlug) {
        if (!configsByMod.has(file.parentModSlug)) configsByMod.set(file.parentModSlug, []);
        configsByMod.get(file.parentModSlug)!.push(file);
      }
    }
  }

  // Explicit mods + phantom entries for config-only slugs
  const displayMods: (CommitModEntry & { phantom?: boolean })[] = changes ? [
    ...changes.mods,
    ...[...configsByMod.keys()]
      .filter(slug => !changes.mods.some(m => m.slug === slug))
      .map(slug => ({
        slug,
        name: configsByMod.get(slug)![0]?.parentModName ?? slug,
        iconUrl: null,
        versionNumber: null,
        status: 'updated' as const,
        phantom: true,
      })),
  ] : [];

  const ungroupedFiles = changes?.otherFiles.filter(f => !f.parentModSlug) ?? [];

  // Collapsed summary
  const summaryMods = changes?.mods ?? [];
  const summaryFileCount = changes?.otherFiles.length ?? 0;
  const shownIcons = summaryMods.slice(0, MAX_SUMMARY_ICONS);
  const overflowCount = summaryMods.length > MAX_SUMMARY_ICONS ? summaryMods.length - MAX_SUMMARY_ICONS : 0;
  const summaryText = summaryMods.length > 0
    ? `${summaryMods.length} mod${summaryMods.length !== 1 ? 's' : ''} changed${summaryFileCount > 0 ? ` · ${summaryFileCount} other file${summaryFileCount !== 1 ? 's' : ''}` : ''}`
    : summaryFileCount > 0
    ? `${summaryFileCount} file${summaryFileCount !== 1 ? 's' : ''} changed`
    : null;

  return (
    <div
      className="rounded-[12px] cursor-pointer group"
      style={{ background: '#323234', border: '1px solid rgba(255,255,255,0.06)', transition: 'background 120ms ease' }}
      onClick={handleCardClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = '#3a3a3c';
        triggerLoad();
      }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#323234'; }}
    >
      {/* Always-visible header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <img
            src={commit.author.avatar_url}
            alt={commit.author.login}
            className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
            onError={e => { e.currentTarget.src = 'https://github.com/ghost.png'; }}
          />

          <div className="flex-1 min-w-0">
            {/* Author + timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-sm font-medium">{commit.author.login}</span>
              <span className="text-xs" style={{ color: '#8b949e' }}>{timeAgo(commit.date)}</span>
            </div>

            {/* Commit message */}
            <p className="text-sm truncate" style={{ color: '#C9D1D9', marginBottom: (isLoaded || fetchLoading) ? 8 : 0 }}>
              {commit.message}
            </p>

            {/* Collapsed summary row */}
            {!isExpanded && isLoaded && (
              <div className="flex items-center gap-2 flex-wrap">
                {shownIcons.length > 0 && (
                  <div className="flex items-center gap-1">
                    {shownIcons.map((mod, i) => <SmallModIcon key={i} mod={mod} />)}
                    {overflowCount > 0 && (
                      <div
                        className="flex items-center justify-center flex-shrink-0 font-medium"
                        style={{ width: 24, height: 24, borderRadius: '50%', background: '#3a3a3c', color: '#8b949e', fontSize: 9 }}
                      >
                        +{overflowCount}
                      </div>
                    )}
                  </div>
                )}
                {summaryText && (
                  <span className="text-xs" style={{ color: '#8b949e' }}>{summaryText}</span>
                )}
              </div>
            )}

            {/* Loading indicator (collapsed) */}
            {!isExpanded && !isLoaded && fetchLoading && (
              <div className="flex items-center gap-1.5" style={{ color: '#8b949e' }}>
                <Loader2 size={11} className="animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            )}
          </div>

          {/* External link + expand chevron */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            <button
              data-noclick="true"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
              title="Open on GitHub"
              onClick={e => { e.stopPropagation(); window.electron.app.openExternal(commit.url); }}
            >
              <ExternalLink size={13} style={{ color: '#8b949e' }} />
            </button>
            <div style={{ transition: 'transform 300ms ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <ChevronRight size={14} style={{ color: '#8b949e' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Expandable detail panel — grid-template-rows animation for smooth height */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 300ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="px-4 pb-4">
            <div className="mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* Loading spinner (expanded, not yet loaded) */}
            {!isLoaded && fetchLoading && (
              <div className="flex items-center gap-1.5" style={{ color: '#8b949e' }}>
                <Loader2 size={11} className="animate-spin" />
                <span className="text-xs">Loading changes…</span>
              </div>
            )}

            {/* Placeholder before first load attempt */}
            {!isLoaded && !fetchLoading && (
              <p className="text-xs" style={{ color: '#4D5461' }}>Loading…</p>
            )}

            {/* Full details */}
            {isLoaded && (
              <div>
                {/* Mods section */}
                {displayMods.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {displayMods.map(mod => {
                      const configs = configsByMod.get(mod.slug) ?? [];
                      const isModExpanded = expandedMods.has(mod.slug);
                      const hasConfigs = configs.length > 0;

                      return (
                        <div key={mod.slug}>
                          {/* Mod row */}
                          <div
                            data-noclick="true"
                            className="flex items-center gap-2 py-1 px-0.5 rounded-[6px] -mx-0.5"
                            style={{ cursor: hasConfigs ? 'pointer' : 'default' }}
                            onClick={e => hasConfigs && toggleMod(mod.slug, e)}
                          >
                            <ModIcon iconUrl={mod.iconUrl} name={mod.name} />
                            <span className="text-sm font-medium text-white flex-1 min-w-0 truncate">
                              {mod.name}
                            </span>
                            {!mod.phantom && (
                              <ModStatusBadge
                                status={mod.status}
                                versionNumber={mod.versionNumber}
                                oldVersionNumber={mod.oldVersionNumber}
                              />
                            )}
                            {hasConfigs && (
                              isModExpanded
                                ? <ChevronDown size={12} style={{ color: '#8b949e' }} className="flex-shrink-0" />
                                : <ChevronRight size={12} style={{ color: '#8b949e' }} className="flex-shrink-0" />
                            )}
                          </div>

                          {/* Config count (collapsed) */}
                          {hasConfigs && !isModExpanded && (
                            <div
                              data-noclick="true"
                              className="flex items-center gap-1 mt-0.5"
                              style={{ paddingLeft: 36, cursor: 'pointer' }}
                              onClick={e => toggleMod(mod.slug, e)}
                            >
                              <span className="text-xs" style={{ color: '#8b949e' }}>
                                {configs.length} config file{configs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}

                          {/* Config files (expanded) */}
                          {hasConfigs && isModExpanded && (
                            <div
                              data-noclick="true"
                              className="flex flex-col gap-0.5 mt-1 mb-0.5"
                              style={{ paddingLeft: 20 }}
                            >
                              {configs.map((file, i) => <ConfigFileRow key={i} file={file} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Divider */}
                {displayMods.length > 0 && ungroupedFiles.length > 0 && (
                  <div className="my-2" style={{ borderTop: '1px solid #21262d' }} />
                )}

                {/* Other files */}
                {ungroupedFiles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {ungroupedFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <StatusDot status={file.status} />
                        <FileTypeIcon filepath={file.path} />
                        <span className="text-xs font-mono truncate flex-1" style={{ color: '#8b949e' }}>
                          {file.path}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nothing to show */}
                {displayMods.length === 0 && ungroupedFiles.length === 0 && (
                  <p className="text-xs" style={{ color: '#4D5461' }}>No file changes recorded</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
