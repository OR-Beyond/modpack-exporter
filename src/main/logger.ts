/**
 * Main-process log capture.
 *
 * Intercepts console.log/info/warn/error in the Electron main process, keeps a
 * ring buffer of the most recent entries, and streams every new entry to the
 * renderer over the `logs:entry` IPC channel. The renderer LogsPage merges
 * these with its own console captures so the user sees the full app activity
 * (git sync, exports, updates…) with a single source of truth.
 */
import { BrowserWindow, ipcMain } from 'electron';

type MainLogLevel = 'log' | 'info' | 'warn' | 'error';

interface MainLogEntry {
  id: number;
  timestamp: string;
  level: MainLogLevel;
  message: string;
  source: 'main';
}

const MAX_LOGS = 2000;
const ENTRY_CHANNEL = 'logs:entry';

let nextId = 0;
let installed = false;
const entries: MainLogEntry[] = [];
let originalFns: Record<string, (...args: unknown[]) => void> = {};

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function broadcast(entry: MainLogEntry): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(ENTRY_CHANNEL, entry);
    }
  }
}

function capture(level: MainLogLevel, original: (...args: unknown[]) => void, ...args: unknown[]): void {
  const entry: MainLogEntry = {
    id: nextId++,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message: args.map(stringify).join(' '),
    source: 'main',
  };
  entries.push(entry);
  if (entries.length > MAX_LOGS) entries.splice(0, entries.length - MAX_LOGS);
  try {
    original.apply(console, args);
  } catch {
    // Never let logging break the caller.
  }
  broadcast(entry);
}

/** Patch console.log/info/warn/error in the main process. Idempotent. */
export function initMainLogger(): void {
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
}

/** Snapshot of the main-process log buffer. */
function getMainLogs(): MainLogEntry[] {
  return [...entries];
}

/** Clear the main-process log buffer (renderer mirrors this via logs:clear). */
function clearMainLogs(): void {
  entries.length = 0;
  nextId = 0;
}

/** Register the logs:* IPC surface. Call once during startup. */
export function registerLogIpc(): void {
  ipcMain.handle('logs:get', () => ({ success: true, data: getMainLogs() }));
  ipcMain.handle('logs:clear', () => {
    clearMainLogs();
    return { success: true };
  });
}
