import React from 'react';
import {
  GitBranch, Download, Upload, Bug, ExternalLink, ArrowUp, ArrowDown, Clock,
  RotateCcw, Package,
} from 'lucide-react';
import type { AppConfig, Issue, SyncStatus, ProfileMode } from '../../types';
import Button from '../base/Button';
import ModeToggle from '../base/ModeToggle';
import { timeAgo } from '../../utils/format';

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted text-xs flex-shrink-0">{label}</span>
      <span
        className="text-xs font-medium truncate text-right min-w-0"
        style={{ color: valueColor || 'rgb(var(--color-foreground))' }}
      >
        {value}
      </span>
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
  onModeChange: (mode: ProfileMode) => void;
}

export default function Sidebar({
  config, syncStatus, issues, lastExportTime, manifestVersion, modrinthRelease,
  onPull, onPush, onUndoLastPush, isUndoingLastPush, onExport, onReportBug,
  profileMode, onModeChange,
}: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col gap-3 overflow-y-auto p-4 border-l border-line/6"
      style={{ width: 296 }}
    >
      {/* Modpack Info */}
      <div className="rounded-[12px] p-3 bg-card">
        <h3 className="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Modpack Info</h3>
        <div className="flex flex-col gap-2">
          {config ? (
            <>
              <Row label="Pack" value={config.pack_name} />
              <Row label="Dev version" value={manifestVersion !== null ? String(manifestVersion) : 'N/A'} />
              <Row label="Modrinth release" value={modrinthRelease ? `v${modrinthRelease}` : 'N/A'} />
              <Row label="Minecraft" value={config.minecraft_version} />
              <div>
                <span className="text-muted text-xs block mb-1.5">Mode</span>
                <ModeToggle mode={profileMode} onChange={onModeChange} />
              </div>
              <div className="h-px bg-line/6 my-0.5" />
              <Row
                label="Last export"
                value={lastExportTime ? timeAgo(lastExportTime) : 'Never'}
              />
            </>
          ) : (
            <p className="text-muted text-xs">No config loaded</p>
          )}
        </div>
      </div>

      {/* Team Sync */}
      <div className="rounded-[12px] p-3 bg-card">
        <h3 className="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Team Sync</h3>
        <div className="flex flex-col gap-1.5 mb-3">
          {syncStatus.branch && (
            <div className="flex items-center gap-1.5 min-w-0">
              <GitBranch size={12} className="text-muted flex-shrink-0" />
              <span className="text-foreground text-xs font-mono truncate">{syncStatus.branch}</span>
              {syncStatus.ahead > 0 && (
                <span className="flex items-center gap-0.5 text-warning text-xs">
                  <ArrowUp size={10} />{syncStatus.ahead}
                </span>
              )}
              {syncStatus.behind > 0 && (
                <span className="flex items-center gap-0.5 text-primary text-xs">
                  <ArrowDown size={10} />{syncStatus.behind}
                </span>
              )}
            </div>
          )}
          {syncStatus.lastPull && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-muted" />
              <span className="text-muted text-xs">Pulled {timeAgo(syncStatus.lastPull)}</span>
            </div>
          )}
          {syncStatus.modified.length > 0 && (
            <p className="text-warning text-xs">
              {syncStatus.modified.length} uncommitted change{syncStatus.modified.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="success"
              size="sm"
              icon={Download}
              className="flex-1"
              onClick={onPull}
            >
              Pull latest
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Upload}
              className="flex-1"
              onClick={onPush}
            >
              Push changes
            </Button>
          </div>
          <Button
            variant="soft-danger"
            size="sm"
            icon={RotateCcw}
            fullWidth
            loading={isUndoingLastPush}
            onClick={onUndoLastPush}
          >
            {isUndoingLastPush ? 'Undoing…' : 'Undo last push'}
          </Button>
        </div>
      </div>

      {/* Export */}
      <Button
        variant="primary"
        icon={Package}
        fullWidth
        onClick={onExport}
        className="py-2.5 rounded-[10px]"
      >
        Export New Version
      </Button>

      {/* Bugs */}
      <div className="rounded-[12px] p-3 bg-card">
        <h3 className="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Bugs</h3>
        {issues.length === 0 ? (
          <p className="text-muted text-xs">No open issues</p>
        ) : (
          <div className="flex flex-col gap-1">
            {issues.map(issue => (
              <button
                key={issue.number}
                onClick={() => window.electron.app.openExternal(issue.html_url)}
                className="w-full text-left p-2 -mx-2 rounded-lg hover:bg-line/6 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground text-xs leading-snug line-clamp-2 flex-1">{issue.title}</p>
                  <ExternalLink size={11} className="text-muted opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-muted text-xs">#{issue.number}</span>
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
          className="flex items-center gap-1.5 text-xs mt-2.5 transition-opacity whitespace-nowrap text-warning hover:opacity-80"
        >
          <Bug size={12} />
          Report a Bug
        </button>
      </div>
    </div>
  );
}
