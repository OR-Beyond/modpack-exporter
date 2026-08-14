/**
 * Renderer-side mod icon cache.
 *
 * The main process persists mod icons on disk (`<userData>/cache/mod-icons/`)
 * and returns them as data URLs over IPC. This module adds an in-memory layer
 * so each slug is resolved at most once per session — re-rendering the same
 * mod across the activity feed, push previews, or pull popups never re-hits
 * the IPC/disk path.
 *
 * Results come back tagged definitive (real icon, or confirmed missing) vs
 * transient (network hiccup). Only definitive results are memoized; transient
 * failures are gated by a cooldown so they are retried after a delay instead
 * of showing a letter placeholder forever.
 */

import type { ModIconResult } from '../types';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const transientAt = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

const RETRY_DELAY_MS = 15_000;

function notify(slug: string): void {
  for (const cb of listeners.get(slug) ?? []) cb();
}

/**
 * Session-cached icon data URL for a slug.
 * `undefined` = not resolved yet, `null` = known to have no icon.
 */
export function getCachedModIcon(slug: string): string | null | undefined {
  return cache.get(slug);
}

/** Subscribe to cache updates for a slug (icon resolved or refreshed). Returns an unsubscribe fn. */
export function subscribeModIcon(slug: string, cb: () => void): () => void {
  let set = listeners.get(slug);
  if (!set) {
    set = new Set();
    listeners.set(slug, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(slug);
  };
}

function storeResult(slug: string, result: ModIconResult): void {
  if (result.definitive) {
    cache.set(slug, result.url);
    transientAt.delete(slug);
  } else {
    transientAt.set(slug, Date.now());
  }
}

function resolveSlug(slug: string): Promise<string | null> {
  const task = window.electron.modrinth
    .getIcons([slug])
    .then(res => {
      const result = res[slug] ?? { url: null, definitive: false };
      storeResult(slug, result);
      notify(slug);
      return result.url;
    })
    .catch(() => {
      transientAt.set(slug, Date.now());
      return null;
    })
    .finally(() => {
      inflight.delete(slug);
    });

  inflight.set(slug, task);
  return task;
}

/** Resolve a slug's icon once per session, deduplicating in-flight requests. */
export function ensureModIcon(slug: string): Promise<string | null> {
  if (cache.has(slug)) return Promise.resolve(cache.get(slug)!);
  const pending = inflight.get(slug);
  if (pending) return pending;
  const lastTransient = transientAt.get(slug);
  if (lastTransient !== undefined && Date.now() - lastTransient < RETRY_DELAY_MS) {
    return Promise.resolve(null);
  }
  return resolveSlug(slug);
}

/**
 * Resolve many slugs in one IPC call, warming the cache for an entire list of
 * mods (a commit's changes, a push preview, etc.) before they render.
 */
export function prefetchModIcons(slugs: string[]): void {
  const fresh = [...new Set(slugs)].filter(slug => !cache.has(slug) && !inflight.has(slug));
  if (fresh.length === 0) return;

  const task = window.electron.modrinth
    .getIcons(fresh)
    .then(res => {
      for (const slug of fresh) {
        const result = res[slug] ?? { url: null, definitive: false };
        storeResult(slug, result);
      }
    })
    .catch(() => {
      const now = Date.now();
      for (const slug of fresh) transientAt.set(slug, now);
    })
    .finally(() => {
      for (const slug of fresh) inflight.delete(slug);
      for (const slug of fresh) notify(slug);
    });

  for (const slug of fresh) inflight.set(slug, task.then(() => cache.get(slug) ?? null));
}
