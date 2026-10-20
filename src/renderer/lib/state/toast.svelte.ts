/**
 * Toast store (runes module).
 *
 * A small, dependency-free replacement for toast lib that reproduces the
 * same visual language: bottom-right stack, 4000ms auto-dismiss, pause on
 * hover, and the success/error/loading icon treatments. The rendering lives in
 * `Toaster.svelte`; this module owns the state and the public API.
 */

export type ToastType = 'blank' | 'success' | 'error' | 'loading';

export interface ToastRecord {
  id: string;
  type: ToastType;
  message: string;
  /** Custom emoji/string icon (blank toasts only). */
  icon?: string;
  /** ms before auto-dismiss; 0 disables auto-dismiss. */
  duration: number;
  /** True once the exit animation has started. */
  dismissed: boolean;
  /** Measured height in px, used to stack newer toasts above older ones. */
  height: number;
  /** Remaining ms when paused (hover), restored on resume. */
  remaining: number;
  /** Timestamp the current timer started. */
  startedAt: number;
  /** True while the pointer is over the toast. */
  paused: boolean;
}

const DEFAULT_DURATION = 4000;
const REMOVE_DELAY = 1000;

let toasts = $state<ToastRecord[]>([]);
let counter = 0;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string): void {
  const t = timers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function scheduleRemoval(id: string, delay: number): void {
  clearTimer(id);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      toasts = toasts.filter(t => t.id !== id);
    }, delay),
  );
}

function startDismissTimer(record: ToastRecord): void {
  if (record.duration <= 0) return;
  record.startedAt = Date.now();
  record.remaining = record.duration;
  scheduleRemoval(record.id, record.duration);
}

function createToast(type: ToastType, message: string, opts?: { icon?: string; duration?: number }): string {
  const id = `toast-${++counter}`;
  const record: ToastRecord = {
    id,
    type,
    message,
    icon: opts?.icon,
    duration: opts?.duration ?? DEFAULT_DURATION,
    dismissed: false,
    height: 0,
    remaining: opts?.duration ?? DEFAULT_DURATION,
    startedAt: Date.now(),
    paused: false,
  };
  toasts = [...toasts, record];
  startDismissTimer(record);
  return id;
}

function dismiss(id?: string): void {
  const targets = id === undefined ? toasts : toasts.filter(t => t.id === id);
  for (const record of targets) {
    if (record.dismissed) continue;
    clearTimer(record.id);
    record.dismissed = true;
    scheduleRemoval(record.id, REMOVE_DELAY);
  }
}

function pause(id: string): void {
  const record = toasts.find(t => t.id === id);
  if (!record || record.dismissed || record.duration <= 0) return;
  record.paused = true;
  record.remaining = Math.max(0, record.remaining - (Date.now() - record.startedAt));
  clearTimer(id);
}

function resume(id: string): void {
  const record = toasts.find(t => t.id === id);
  if (!record || record.dismissed || record.duration <= 0) return;
  record.paused = false;
  record.startedAt = Date.now();
  scheduleRemoval(id, record.remaining);
}

function setHeight(id: string, height: number): void {
  const record = toasts.find(t => t.id === id);
  if (record) record.height = height;
}

interface ToastFn {
  (message: string, opts?: { icon?: string; duration?: number }): string;
  success: (message: string, opts?: { duration?: number }) => string;
  error: (message: string, opts?: { duration?: number }) => string;
  loading: (message: string, opts?: { duration?: number }) => string;
  dismiss: (id?: string) => void;
}

const toast = ((message: string, opts?: { icon?: string; duration?: number }) =>
  createToast('blank', message, opts)) as ToastFn;

toast.success = (message, opts) => createToast('success', message, opts);
toast.error = (message, opts) => createToast('error', message, opts);
toast.loading = (message, opts) => createToast('loading', message, opts);
toast.dismiss = dismiss;

export const toastState = {
  get list(): ToastRecord[] {
    return toasts;
  },
  pause,
  resume,
  setHeight,
};

export { toast };
