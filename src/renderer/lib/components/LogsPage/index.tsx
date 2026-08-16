import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Trash2, AlertTriangle, Info, Search, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../base/Button';
import Badge, { type BadgeTone } from '../base/Badge';
import Input from '../base/Input';
import ExpandableText from '../base/ExpandableText';
import {
  getLogs, clearLogs, subscribe, formatLogsForClipboard, type LogEntry,
} from '../../utils/logger';
import type { LogLevel } from '../../types';

// Context tags are freeform text inside the message — no structured
// categorization. Map known tags (exact match first, prefix fallback) to
// semantic Badge tones so they read consistently with the rest of the app.
const TAG_TONES: Record<string, BadgeTone> = {
  'main': 'info',
  'updater': 'info',
  'scan': 'warning',
  'git:pull': 'success',
  'git:ensure-versions-repo': 'success',
  'git': 'success',
  'pull': 'success',
  'push': 'warning',
  'undo-push': 'danger',
  'discord': 'info',
  'changelog': 'info',
  'export': 'warning',
  'modrinth-cache': 'warning',
  'pull-state': 'neutral',
};

// `all` shows everything; info/warn/error show that severity and above.
const FILTERS: { value: 'all' | LogLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info+' },
  { value: 'warn', label: 'Warnings+' },
  { value: 'error', label: 'Errors' },
];

const SEVERITY: Record<LogLevel, number> = { log: 0, info: 1, warn: 2, error: 3 };

function parseTag(message: string): { tag: string | null; rest: string } {
  const m = message.match(/^\[([^\]]+)\]\s*(.*)/);
  if (m) return { tag: m[1], rest: m[2] };
  return { tag: null, rest: message };
}

function tagTone(tag: string): BadgeTone {
  if (TAG_TONES[tag]) return TAG_TONES[tag];
  for (const [prefix, tone] of Object.entries(TAG_TONES)) {
    if (tag.startsWith(prefix)) return tone;
  }
  return 'neutral';
}

function LogIcon({ level }: { level: LogEntry['level'] }) {
  switch (level) {
    case 'error':
      return <XCircle size={13} className="text-danger flex-shrink-0 mt-0.5" />;
    case 'warn':
      return <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />;
    case 'info':
      return <Info size={13} className="text-primary flex-shrink-0 mt-0.5" />;
    default:
      return <Info size={13} className="text-muted flex-shrink-0 mt-0.5" />;
  }
}

function levelClass(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'bg-danger/10 border-l-2 border-danger/50';
    case 'warn':
      return 'bg-warning/10 border-l-2 border-warning/50';
    default:
      return '';
  }
}

function levelTextClass(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-danger';
    case 'warn':
      return 'text-warning';
    default:
      return 'text-foreground';
  }
}

export default function LogsPage() {
  const [, forceUpdate] = useState(0);
  const [filter, setFilter] = useState<'all' | LogLevel>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live store: renderer console captures + main-process stream, no polling.
  useEffect(() => subscribe(() => forceUpdate(n => n + 1)), []);

  const logs = getLogs();
  const query = search.trim().toLowerCase();
  const visibleLogs = logs.filter(
    e =>
      (filter === 'all' || SEVERITY[e.level] >= SEVERITY[filter]) &&
      (!query || e.message.toLowerCase().includes(query)),
  );

  // Auto-scroll to bottom when new logs arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatLogsForClipboard(visibleLogs));
      setCopied(true);
      toast.success('Logs copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy logs');
    }
  };

  const handleClear = () => {
    clearLogs();
    toast.success('Logs cleared');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
        <h2 className="text-foreground font-semibold text-base">Logs</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            disabled={logs.length === 0}
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            variant={copied ? 'soft-success' : 'primary'}
            size="sm"
            icon={copied ? Check : Copy}
            disabled={logs.length === 0}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy Logs'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-line/6 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                filter === f.value ? 'bg-line/8 text-foreground' : 'text-muted hover:bg-line/4'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs…"
            aria-label="Search logs"
            className="pl-9 h-8 py-1.5 text-xs"
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted text-sm">No logs yet. App activity will appear here.</p>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted text-sm">No logs match this filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleLogs.map(entry => {
              const { tag, rest } = parseTag(entry.message);
              return (
                <div
                  key={`${entry.source}-${entry.id}`}
                  className={`flex items-start gap-1.5 px-3 py-2 rounded-[8px] text-xs leading-relaxed ${levelClass(entry.level)}`}
                >
                  <LogIcon level={entry.level} />
                  <span className="text-muted-foreground w-20 flex-shrink-0 select-none tabular-nums">
                    {entry.timestamp}
                  </span>
                  <span
                    className={`${levelTextClass(entry.level)} flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-1`}
                  >
                    {tag && <Badge tone={tagTone(tag)}>{tag}</Badge>}
                    <ExpandableText text={tag ? rest : entry.message} lines={3} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
