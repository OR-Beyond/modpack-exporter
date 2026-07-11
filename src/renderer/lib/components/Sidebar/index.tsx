import React from 'react';
import { GitBranch, Download, Upload, Bug, ExternalLink, ArrowUp, ArrowDown, Clock, Loader2, RotateCcw, Package, History, Shield, Server } from 'lucide-react';
import type { AppConfig, Issue, SyncStatus, ProfileMode } from '../../types';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#A9A9AB] text-xs flex-shrink-0">{label}</span>
      <span className="text-xs font-medium truncate text-right min-w-0" style={{ color: valueColor || '#ffffff' }}>{value}</span>
    </div>
  );
}

interface Props {
  config: AppConfig | null;
  syncStatus: SyncStatus;
  issues: Issue[];
  lastExportTime: string | null;
  manifestVersion: number | null;
  modrinthRelease: string | null;
  onPull: () => void;
  onPush: () => void;
  onUndoLastPush: () => void;
  isUndoingLastPush: boolean;
  onExport: () => void;
  onReportBug: () => void;
  profileMode: ProfileMode;
  lastSnapshotTime: string | null;
  onVersionHistory: () => void;
  onPromote: () => void;
  onTakeSnapshot: () => void;
}

export default function Sidebar({ config, syncStatus, issues, lastExportTime, manifestVersion, modrinthRelease, onPull, onPush, onUndoLastPush, isUndoingLastPush, onExport, onReportBug, profileMode, lastSnapshotTime, onVersionHistory, onPromote, onTakeSnapshot }: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col gap-4 overflow-y-auto p-5 border-l border-white/[0.06]"
      style={{ width: 308 }}
    >
      {/* Modpack Info */}
      <div className="rounded-[12px] p-3.5" style={{ background: '#323234' }}>
        <h3 className="text-white font-semibold text-sm mb-2.5">Modpack Info</h3>
        <div className="flex flex-col gap-2.5">
          {config ? (
            <>
              <Row label="Pack" value={config.pack_name} />
              <Row label="Dev version" value={manifestVersion !== null ? String(manifestVersion) : 'N/A'} />
              <Row label="Modrinth release" value={modrinthRelease ? `v${modrinthRelease}` : 'N/A'} />
              <Row label="Minecraft" value={config.minecraft_version} />
              <Row
                label="Mode"
                value={profileMode === 'prod' ? 'Production' : 'Development'}
                valueColor={profileMode === 'prod' ? '#0890FE' : '#FFA809'}
              />
              <div className="h-px bg-white/[0.06] my-0.5" />
              <Row
                label="Last export"
                value={lastExportTime ? timeAgo(lastExportTime) : 'Never'}
              />
            </>
          ) : (
            <p className="text-[#A9A9AB] text-xs">No config loaded</p>
          )}
        </div>
      </div>

      {/* Team Sync */}
      <div className="rounded-[12px] p-3.5" style={{ background: '#323234' }}>
        <h3 className="text-white font-semibold text-sm mb-2.5">Team Sync</h3>
        <div className="flex flex-col gap-2 mb-4">
          {syncStatus.branch && (
            <div className="flex items-center gap-1.5 min-w-0">
              <GitBranch size={12} className="text-[#A9A9AB] flex-shrink-0" />
              <span className="text-white text-xs font-mono truncate">{syncStatus.branch}</span>
              {syncStatus.ahead > 0 && (
                <span className="flex items-center gap-0.5 text-[#FFA809] text-xs">
                  <ArrowUp size={10} />{syncStatus.ahead}
                </span>
              )}
              {syncStatus.behind > 0 && (
                <span className="flex items-center gap-0.5 text-[#0890FE] text-xs">
                  <ArrowDown size={10} />{syncStatus.behind}
                </span>
              )}
            </div>
          )}
          {syncStatus.lastPull && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-[#A9A9AB]" />
              <span className="text-[#A9A9AB] text-xs">Pulled {timeAgo(syncStatus.lastPull)}</span>
            </div>
          )}
          {syncStatus.modified.length > 0 && (
            <p className="text-[#FFA809] text-xs">{syncStatus.modified.length} uncommitted change{syncStatus.modified.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={onPull}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-white text-xs font-medium transition-all whitespace-nowrap"
              style={{ background: '#20AC64' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#26c073')}
              onMouseLeave={e => (e.currentTarget.style.background = '#20AC64')}
            >
              <Download size={13} />
              Pull latest
            </button>
            <button
              onClick={onPush}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-white text-xs font-medium transition-all whitespace-nowrap"
              style={{ background: '#0890FE' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
            >
              <Upload size={13} />
              Push changes
            </button>
          </div>
          <button
            onClick={onUndoLastPush}
            disabled={isUndoingLastPush}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{
              color: '#f85149',
              background: 'transparent',
              border: '1px solid rgba(248,81,73,0.35)',
            }}
            onMouseEnter={e => {
              if (!isUndoingLastPush) {
                e.currentTarget.style.background = 'rgba(248,81,73,0.08)';
                e.currentTarget.style.borderColor = 'rgba(248,81,73,0.7)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(248,81,73,0.35)';
            }}
          >
            {isUndoingLastPush ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Undoing…
              </>
            ) : (
              <>
                <RotateCcw size={12} />
                Undo last push
              </>
            )}
          </button>
        </div>

        <button
          onClick={onVersionHistory}
          className="flex items-center gap-1.5 text-xs mt-3 transition-colors whitespace-nowrap"
          style={{ color: '#A9A9AB' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#A9A9AB')}
        >
          <History size={12} />
          Version history
        </button>
      </div>

      {(profileMode === 'prod' || lastSnapshotTime) && (
        <div className="rounded-[12px] p-3.5" style={{ background: '#323234' }}>
          <h3 className="text-white font-semibold text-sm mb-2.5">Profile Protection</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Shield size={12} className={lastSnapshotTime ? 'text-[#20AC64]' : 'text-[#A9A9AB]'} />
              <span className="text-[#A9A9AB] text-xs">
                {lastSnapshotTime ? `Snapshotted ${timeAgo(lastSnapshotTime)}` : 'No snapshots yet'}
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={onTakeSnapshot}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-xs font-medium transition-all"
                style={{ color: '#20AC64', border: '1px solid rgba(32,172,100,0.35)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(32,172,100,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Shield size={11} />
                Snapshot
              </button>
              {profileMode === 'dev' && (
                <button
                  onClick={onPromote}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-xs font-medium transition-all"
                  style={{ color: '#0890FE', border: '1px solid rgba(8,144,254,0.35)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(8,144,254,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Server size={11} />
                  Promote
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      <button
        onClick={onExport}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-white text-sm font-medium transition-all"
        style={{ background: '#0890FE' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
      >
        <Package size={15} />
        Export New Version
      </button>

      {/* Bugs */}
      <div className="rounded-[12px] p-3.5" style={{ background: '#323234' }}>
        <h3 className="text-white font-semibold text-sm mb-2.5">Bugs</h3>
        {issues.length === 0 ? (
          <p className="text-[#A9A9AB] text-xs">No open issues</p>
        ) : (
          <div className="flex flex-col gap-1">
            {issues.map(issue => (
              <button
                key={issue.number}
                onClick={() => window.electron.app.openExternal(issue.html_url)}
                className="w-full text-left p-2 -mx-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-xs leading-snug line-clamp-2 flex-1">{issue.title}</p>
                  <ExternalLink size={11} className="text-[#A9A9AB] opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[#A9A9AB] text-xs">#{issue.number}</span>
                  {issue.labels?.slice(0, 3).map(l => (
                    <span
                      key={l.name}
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: `#${l.color}1f`,
                        color: `#${l.color}`,
                        border: `1px solid #${l.color}33`,
                      }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onReportBug}
          className="flex items-center gap-1.5 text-xs mt-3 transition-colors whitespace-nowrap"
          style={{ color: '#FFA809' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Bug size={12} />
          Report a Bug
        </button>
      </div>
    </div>
  );
}
