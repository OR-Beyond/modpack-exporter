import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight, Check, FolderOpen,
  AlertCircle, Loader2, Blocks, Boxes, Package, Layers, Flame, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { LauncherProfileGroup } from '../../types';

interface Props {
  /** Currently selected modpack root path (empty string if none). */
  selectedPath: string;
  /** Called after a profile (or manually-browsed folder) has been selected and
   *  persisted as the modpack root. */
  onSelected: (path: string, profileName?: string) => void;
}

// ── Dark theme palette (kept local — matches the app's GitHub-style surfaces) ──
const C = {
  bg:       '#0d1117',
  surface:  '#161b22',
  border:   '#30363d',
  elevated: '#21262d',
  text:     '#c9d1d9',
  muted:    '#8b949e',
  accent:   '#58a6ff',
  danger:   '#f85149',
} as const;

const LAUNCHER_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  modrinth:   { Icon: Blocks,   color: '#00AF5C' },
  prism:      { Icon: Boxes,    color: '#9C6ADE' },
  multimc:    { Icon: Package,  color: '#4A90D9' },
  atlauncher: { Icon: Layers,   color: '#E1B12C' },
  curseforge: { Icon: Flame,    color: '#F16436' },
  gdlauncher: { Icon: Sparkles, color: '#00C2CB' },
};

function launcherIconFor(key: string) {
  return LAUNCHER_ICONS[key] ?? { Icon: Package, color: C.muted };
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ProfileSelector({ selectedPath, onSelected }: Props) {
  const [groups, setGroups] = useState<LauncherProfileGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const scan = useCallback(async (currentSelectedPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.modpack.listProfiles();
      if (!result.success) {
        setGroups([]);
        setError(result.error || 'Scan failed');
        return;
      }
      setGroups(result.data);
      // Default expand: groups containing the currently selected profile open,
      // everything else collapsed. Only computed on a fresh scan — the user is
      // free to toggle groups afterward without them snapping back.
      const nextExpanded: Record<string, boolean> = {};
      for (const group of result.data) {
        nextExpanded[group.launcher] = group.profiles.some(p => p.path === currentSelectedPath);
      }
      setExpanded(nextExpanded);
    } catch (e: any) {
      setGroups([]);
      setError(e?.message ?? 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan(selectedPath);
    // Only run once on mount — refreshes afterward are user-triggered so the
    // expand state doesn't get silently recomputed out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => scan(selectedPath);

  const handleSelectPath = useCallback(async (path: string, name?: string) => {
    try {
      await window.electron.modpack.setRootFromProfile(path);
      onSelected(path, name);
    } catch (e: any) {
      toast.error(`Could not select profile: ${e?.message ?? 'unknown error'}`);
    }
  }, [onSelected]);

  const handleBrowse = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (!dir) return;
    await handleSelectPath(dir);
  };

  const toggleGroup = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  // ── Search filtering ───────────────────────────────────────────────────────
  const query = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    return groups
      .map(g => ({ ...g, profiles: g.profiles.filter(p => p.name.toLowerCase().includes(query)) }))
      .filter(g => g.profiles.length > 0);
  }, [groups, query]);

  const isExpanded = (key: string) => (query ? true : (expanded[key] ?? false));

  // ── Styling shortcuts ──────────────────────────────────────────────────────
  const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, color: C.text } as const;

  return (
    <div className="flex flex-col gap-2.5" style={{ color: C.text }}>
      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search profiles…"
            className="w-full rounded-[8px] pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
            style={{ ...inputStyle }}
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Rescan all launchers"
          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium transition-colors disabled:opacity-50"
          style={{ background: C.elevated, border: `1px solid ${C.border}`, color: C.text }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* List surface */}
      <div
        className="rounded-[8px] overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div className="max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs justify-center" style={{ color: C.muted }}>
              <Loader2 size={13} className="animate-spin" />
              Scanning launchers…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs justify-center" style={{ color: C.danger }}>
              <AlertCircle size={13} />
              {error}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center" style={{ color: C.muted }}>
              {query
                ? `No profiles match "${search}"`
                : 'No modded profiles found on this machine. Use Browse manually below.'}
            </div>
          ) : (
            filteredGroups.map(group => {
              const { Icon, color } = launcherIconFor(group.launcherIcon);
              const open = isExpanded(group.launcher);
              return (
                <div key={group.launcher} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => toggleGroup(group.launcher)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {open ? <ChevronDown size={13} style={{ color: C.muted }} /> : <ChevronRight size={13} style={{ color: C.muted }} />}
                    <Icon size={14} style={{ color }} className="flex-shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{group.launcher}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>
                      {pluralize(group.profiles.length, 'profile', 'profiles')}
                    </span>
                  </button>

                  {open && (
                    <div className="pb-1">
                      {group.profiles.map(profile => {
                        const isSelected = profile.path === selectedPath;
                        return (
                          <button
                            key={profile.path}
                            onClick={() => handleSelectPath(profile.path, profile.name)}
                            title={profile.path}
                            className="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors"
                            style={{ background: isSelected ? 'rgba(88,166,255,0.12)' : 'transparent' }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.elevated; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {isSelected
                              ? <Check size={12} style={{ color: C.accent }} className="flex-shrink-0" />
                              : <span className="w-3 flex-shrink-0" />}
                            <span className="text-sm truncate flex-1" style={{ color: isSelected ? C.accent : C.text }}>
                              {profile.name}
                            </span>
                            <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>
                              {pluralize(profile.modCount, 'mod', 'mods')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Browse manually — always available, pinned below the scanned groups */}
        <button
          onClick={handleBrowse}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
          style={{ borderTop: `1px solid ${C.border}`, background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <FolderOpen size={14} style={{ color: C.accent }} className="flex-shrink-0" />
          <span className="text-sm font-medium" style={{ color: C.accent }}>Browse manually…</span>
        </button>
      </div>

      {/* Currently selected path */}
      {selectedPath && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
          <Check size={11} style={{ color: '#20AC64' }} className="flex-shrink-0" />
          <span className="truncate font-mono" title={selectedPath}>{selectedPath}</span>
        </div>
      )}
    </div>
  );
}
