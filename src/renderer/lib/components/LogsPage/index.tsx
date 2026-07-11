import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Trash2, AlertTriangle, Info, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLogs, clearLogs, formatLogsForClipboard, type LogEntry } from '../../utils/logger';

const TAG_COLORS: Record<string, string> = {
  'main': '#58a6ff',
  'updater': '#bc8cff',
  'scan': '#f0883e',
  'git:pull': '#3fb950',
  'git:ensure-versions-repo': '#3fb950',
  'git': '#3fb950',
  'pull': '#3fb950',
  'push': '#d29922',
  'undo-push': '#f85149',
  'discord': '#5865f2',
  'changelog': '#79c0ff',
  'export': '#ffa657',
  'modrinth-cache': '#ffa657',
  'pull-state': '#8b949e',
};

const DEFAULT_TAG_COLOR = '#8b949e';

function parseTag(message: string): { tag: string | null; rest: string } {
  const m = message.match(/^\[([^\]]+)\]\s*(.*)/);
  if (m) return { tag: m[1], rest: m[2] };
  return { tag: null, rest: message };
}

function tagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  for (const [prefix, color] of Object.entries(TAG_COLORS)) {
    if (tag.startsWith(prefix)) return color;
  }
  return DEFAULT_TAG_COLOR;
}

function formatMessage(message: string): React.ReactNode {
  const { tag, rest } = parseTag(message);
  if (!tag) {
    return <span>{message}</span>;
  }
  const color = tagColor(tag);
  return (
    <>
      <span
        className="font-mono rounded px-1 py-0.5 text-[11px] font-semibold flex-shrink-0"
        style={{
          color,
          background: `${color}18`,
          border: `1px solid ${color}30`,
        }}
      >
        {tag}
      </span>
      <span className="text-inherit">{rest}</span>
    </>
  );
}

export default function LogsPage() {
  const [, forceUpdate] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  // Poll for new logs every 500ms
  useEffect(() => {
    pollingRef.current = setInterval(() => forceUpdate(n => n + 1), 500);
    return () => clearInterval(pollingRef.current);
  }, []);

  const logs = getLogs();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatLogsForClipboard(logs));
      setCopied(true);
      toast.success('Logs copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy logs');
    }
  };

  const handleClear = () => {
    clearLogs();
    forceUpdate(n => n + 1);
    toast.success('Logs cleared');
  };

  function LogIcon({ level }: { level: LogEntry['level'] }) {
    switch (level) {
      case 'error':
        return <XCircle size={13} className="text-[#E24729] flex-shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle size={13} className="text-[#FFA809] flex-shrink-0 mt-0.5" />;
      case 'info':
        return <Info size={13} className="text-[#0890FE] flex-shrink-0 mt-0.5" />;
      default:
        return <Info size={13} className="text-[#A9A9AB] flex-shrink-0 mt-0.5" />;
    }
  }

  function levelStyle(level: LogEntry['level']): React.CSSProperties {
    switch (level) {
      case 'error':
        return { background: 'rgba(226,71,41,0.08)', borderLeft: '2px solid rgba(226,71,41,0.5)' };
      case 'warn':
        return { background: 'rgba(255,168,9,0.06)', borderLeft: '2px solid rgba(255,168,9,0.4)' };
      default:
        return {};
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-white font-semibold text-base">Logs</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
            style={{ color: '#A9A9AB', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Trash2 size={12} />
            Clear
          </button>
          <button
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: copied ? 'rgba(32,172,100,0.15)' : '#0890FE',
              color: copied ? '#20AC64' : '#fff',
            }}
            onMouseEnter={e => { if (!copied && logs.length > 0) e.currentTarget.style.background = '#1a9dff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = copied ? 'rgba(32,172,100,0.15)' : '#0890FE'; }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy Logs'}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#A9A9AB] text-sm">No logs yet. App activity will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {logs.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-2 px-3 py-1.5 rounded-[6px] text-xs leading-relaxed"
                style={levelStyle(entry.level)}
              >
                <LogIcon level={entry.level} />
                <span className="text-[#585858] flex-shrink-0 w-20 select-none">
                  {entry.timestamp}
                </span>
                <span
                  className={
                    entry.level === 'error' ? 'text-[#f87171] flex-1 min-w-0'
                    : entry.level === 'warn' ? 'text-[#fbbf24] flex-1 min-w-0'
                    : 'text-[#D4D4D4] flex-1 min-w-0'
                  }
                  style={{ wordBreak: 'break-word', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}
                >
                  {formatMessage(entry.message)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
