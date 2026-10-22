import type { LogEntry } from '../types';

export type { LogEntry } from '../types';

const MAX_LOGS = 1000;
let nextId = 0;
let installed = false;
const entries: LogEntry[] = [];
const mainIds = new Set<number>();
const listeners = new Set<() => void>();
let originalFns: Record<string, (...args: unknown[]) => void> = {};

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must not break the log store.
    }
  }
}

function addEntry(entry: LogEntry): void {
  // Main entries arrive twice — once via the logs:get seed snapshot and once
  // via the live logs:entry stream — so dedupe by the main process's ids.
  if (entry.source === 'main') {
    if (mainIds.has(entry.id)) return;
    mainIds.add(entry.id);
  }
  entries.push(entry);
  if (entries.length > MAX_LOGS) entries.splice(0, entries.length - MAX_LOGS);
  notifyListeners();
}

function capture(level: LogEntry['level'], original: (...args: unknown[]) => void, ...args: unknown[]): void {
  addEntry({
    id: nextId++,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message: args.map(a => (typeof a === 'string' ? a : tryStringify(a))).join(' '),
    source: 'renderer',
  });
  original.apply(console, args);
}

function tryStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Install interceptors on console.log/info/warn/error to capture all app logs. */
export function initLogger(): void {
  if (installed) return;
  installed = true;
  originalFns = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => capture('log', originalFns.log, ...args);
  console.info = (...args: unknown[]) => capture('info', originalFns.info, ...args);
  console.warn = (...args: unknown[]) => capture('warn', originalFns.warn, ...args);
  console.error = (...args: unknown[]) => capture('error', originalFns.error, ...args);

  // Seed with the main-process buffer, then stream new entries live so nothing
  // between the snapshot and the subscription is lost.
  const logsApi = window.electron.logs;
  if (logsApi) {
    void logsApi
      .get()
      .then(res => {
        if (res.success && res.data) {
          for (const entry of res.data) addEntry(entry);
        }
      })
      .catch(() => {});
    logsApi.onEntry(entry => addEntry(entry));
  }
}

/** Restore original console functions (useful for cleanup). */
function destroyLogger(): void {
  if (!installed) return;
  installed = false;
  window.electron.logs?.offEntry();
  if (originalFns.log) console.log = originalFns.log;
  if (originalFns.info) console.info = originalFns.info;
  if (originalFns.warn) console.warn = originalFns.warn;
  if (originalFns.error) console.error = originalFns.error;
  originalFns = {};
}

/** Subscribe to log-store changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Return all captured log entries. */
export function getLogs(): LogEntry[] {
  return entries;
}

/** Clear all captured logs (renderer store + main-process buffer). */
export function clearLogs(): void {
  entries.length = 0;
  nextId = 0;
  mainIds.clear();
  void window.electron.logs?.clear().catch(() => {});
  notifyListeners();
}

/** Build a plain-text string of all logs (for clipboard copy). */
export function formatLogsForClipboard(logs: LogEntry[]): string {
  return logs
    .map(e => {
      const level = e.level.toUpperCase().padEnd(5);
      return `[${e.timestamp}] ${level} ${e.message}`;
    })
    .join('\n');
}
