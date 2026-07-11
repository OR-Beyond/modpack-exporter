export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

let nextId = 0;
const entries: LogEntry[] = [];
const MAX_LOGS = 1000;
let originalFns: Record<string, (...args: unknown[]) => void> = {};

function capture(level: LogEntry['level'], original: (...args: unknown[]) => void, ...args: unknown[]) {
  entries.push({
    id: nextId++,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message: args.map(a => (typeof a === 'string' ? a : tryStringify(a))).join(' '),
  });
  if (entries.length > MAX_LOGS) entries.splice(0, entries.length - MAX_LOGS);
  original.apply(console, args);
}

function tryStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Install interceptors on console.log/warn/error to capture all app logs. */
export function initLogger() {
  originalFns = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => capture('log', originalFns.log, ...args);
  console.warn = (...args: unknown[]) => capture('warn', originalFns.warn, ...args);
  console.error = (...args: unknown[]) => capture('error', originalFns.error, ...args);
}

/** Restore original console functions (useful for cleanup). */
export function destroyLogger() {
  if (originalFns.log) console.log = originalFns.log;
  if (originalFns.warn) console.warn = originalFns.warn;
  if (originalFns.error) console.error = originalFns.error;
  originalFns = {};
}

/** Return all captured log entries. */
export function getLogs(): LogEntry[] {
  return entries;
}

/** Clear all captured logs. */
export function clearLogs(): void {
  entries.length = 0;
  nextId = 0;
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
