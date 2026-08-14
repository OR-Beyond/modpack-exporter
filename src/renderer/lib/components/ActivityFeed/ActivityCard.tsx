import React, { useRef, useState } from 'react';
import {
  Box, ChevronDown, ChevronRight, Code, ExternalLink,
  File, Image, Loader2, Settings,
} from 'lucide-react';
import type { CommitCard, CommitChanges, CommitFileEntry, CommitModEntry } from '../../types';
import ModIconLazy from '../common/ModIconLazy';
import ModStatusBadge from '../common/ModStatusBadge';
import Badge from '../base/Badge';
import { timeAgo } from '../../utils/format';
import { prefetchModIcons } from '../../utils/modIcons';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\//);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function statusRingClass(status: CommitModEntry['status']): string {
  if (status === 'added') return 'border-success/40';
  if (status === 'removed') return 'border-danger/40';
  return 'border-warning-soft/40';
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'added' ? 'bg-success'
    : status === 'removed' ? 'bg-danger'
    : 'bg-warning-soft';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

function FileTypeIcon({ filepath }: { filepath: string }) {
  let Icon = File;
  if (filepath.startsWith('overrides/config/') || filepath === 'config.yaml') Icon = Settings;
  else if (filepath.startsWith('overrides/resourcepacks/')) Icon = Image;
  else if (filepath.startsWith('overrides/shaderpacks/')) Icon = Box;
  else if (filepath.startsWith('overrides/scripts/')) Icon = Code;
  return <Icon size={12} className="text-muted-foreground flex-shrink-0" />;
}

function ConfigFileRow({ file }: { file: CommitFileEntry }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <StatusDot status={file.status} />
      <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
        {file.path}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MAX_SUMMARY_ICONS = 5;

interface Props {
  commit: CommitCard;
  /** Absolute date/time instead of relative time (history page). */
  fullDate?: boolean;
}

export default function ActivityCard({ commit, fullDate = false }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set());
  const [localChanges, setLocalChanges] = useState<CommitChanges | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const fetchAttempted = useRef(false);

  const changes: CommitChanges | null = commit.changes ?? localChanges;
  const isLoaded = commit.detailsLoaded || localChanges !== null;

  const triggerLoad = async () => {
    if (fetchAttempted.current || commit.detailsLoaded || fetchLoading) return;
    const parsed = parseOwnerRepo(commit.url);
    if (!parsed) return;
    setFetchLoading(true);
    try {
      const [changesRes, filesRes] = await Promise.all([
        window.electron.git.commitChanges(commit.sha),
        window.electron.github.getCommitFiles({ ...parsed, sha: commit.sha }),
      ]);

      let changes: CommitChanges | null = null;
      if (changesRes.success && changesRes.data &&
          (changesRes.data.mods.length > 0 || changesRes.data.otherFiles.length > 0)) {
        changes = changesRes.data;
      } else if (filesRes.success && filesRes.data) {
        changes = {
          mods: filesRes.data.modChanges.map(mc => ({
            slug: mc.slug,
            name: mc.name,
            iconUrl: null,
            versionNumber: null,
            status: mc.type,
          })),
          otherFiles: filesRes.data.files.map(f => ({
            path: f.path,
            status: f.status as 'added' | 'modified' | 'removed',
          })),
        };
      } else {
        changes = { mods: [], otherFiles: [] };
      }

      setLocalChanges(changes);
      fetchAttempted.current = true;

      if (changes.mods.length > 0) {
        prefetchModIcons(changes.mods.map(m => m.slug));
      }
    } catch (err) {
      // Transient failure — keep whatever was loaded and allow a retry on the
      // next hover/click instead of showing an empty list forever.
      console.warn(`[activity] failed to load changes for ${commit.sha}:`, err);
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
      className="rounded-[12px] cursor-pointer group bg-card border border-line/6 hover:bg-line/5 transition-colors"
      onClick={handleCardClick}
      onMouseEnter={triggerLoad}
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
              <span className="text-foreground text-sm font-medium">{commit.author.login}</span>
              <span className="text-xs text-muted-foreground">
                {fullDate ? new Date(commit.date).toLocaleString() : timeAgo(commit.date)}
              </span>
            </div>

            {/* Commit message */}
            <p className="text-sm truncate text-foreground" style={{ marginBottom: (isLoaded || fetchLoading) ? 8 : 0 }}>
              {commit.message}
            </p>

            {/* Collapsed summary row */}
            {!isExpanded && isLoaded && (
              <div className="flex items-center gap-2 flex-wrap">
                {shownIcons.length > 0 && (
                  <div className="flex items-center gap-1">
                    {shownIcons.map(mod => (
                      <ModIconLazy
                        key={mod.slug}
                        slug={mod.slug}
                        name={mod.name}
                        size="sm"
                        className={`border-2 ${statusRingClass(mod.status)}`}
                      />
                    ))}
                    {overflowCount > 0 && (
                      <div
                        className="flex items-center justify-center flex-shrink-0 font-medium rounded-full bg-line/10 text-muted-foreground w-6 h-6 text-[9px]"
                      >
                        +{overflowCount}
                      </div>
                    )}
                  </div>
                )}
                {summaryText && (
                  <span className="text-xs text-muted-foreground">{summaryText}</span>
                )}
              </div>
            )}

            {/* Loading indicator (collapsed) */}
            {!isExpanded && !isLoaded && fetchLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
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
              <ExternalLink size={13} className="text-muted" />
            </button>
            <div style={{ transition: 'transform 300ms ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <ChevronRight size={14} className="text-muted" />
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
            <div className="mb-3 border-t border-line/6" />

            {/* Loading spinner (expanded, not yet loaded) */}
            {!isLoaded && fetchLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 size={11} className="animate-spin" />
                <span className="text-xs">Loading changes…</span>
              </div>
            )}

            {/* Placeholder before first load attempt */}
            {!isLoaded && !fetchLoading && (
              <p className="text-xs text-muted-foreground">Loading…</p>
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
                            <ModIconLazy slug={mod.slug} name={mod.name} size="md" />
                            <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
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
                                ? <ChevronDown size={12} className="text-muted flex-shrink-0" />
                                : <ChevronRight size={12} className="text-muted flex-shrink-0" />
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
                              <span className="text-xs text-muted-foreground">
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
                              {configs.map(file => <ConfigFileRow key={file.path} file={file} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Divider */}
                {displayMods.length > 0 && ungroupedFiles.length > 0 && (
                  <div className="my-2 border-t border-line-strong" />
                )}

                {/* Other files */}
                {ungroupedFiles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {ungroupedFiles.map(file => (
                      <div key={file.path} className="flex items-center gap-1.5 min-w-0">
                        <StatusDot status={file.status} />
                        <FileTypeIcon filepath={file.path} />
                        <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
                          {file.path}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nothing to show */}
                {displayMods.length === 0 && ungroupedFiles.length === 0 && (
                  <p className="text-xs text-muted-foreground">No file changes recorded</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
