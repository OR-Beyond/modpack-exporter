import React, { useEffect, useRef, useState } from 'react';
import ModIcon, { type ModIconSize } from './ModIcon';
import { ensureModIcon, getCachedModIcon, subscribeModIcon } from '../../utils/modIcons';

interface Props {
  slug: string;
  name: string;
  size?: ModIconSize;
  /** Removed mods render dimmed. */
  dimmed?: boolean;
  className?: string;
}

const RETRY_DELAY_MS = 15_000;

/**
 * Lazy mod icon — defers the Modrinth icon lookup until the element approaches
 * the viewport (IntersectionObserver), so long commit feeds don't fire a burst
 * of IPC requests up front. Subscribes to the modIcons cache so icons that
 * resolve later (prefetch, retry after a transient failure) re-render in place;
 * renders the ModIcon letter placeholder while pending.
 */
export default function ModIconLazy({ slug, name, size = 'md', dimmed = false, className = '' }: Props) {
  const [iconUrl, setIconUrl] = useState<string | null | undefined>(() => getCachedModIcon(slug));
  const ref = useRef<HTMLSpanElement>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Re-render when the cache resolves this slug (prefetch or retry success).
  useEffect(() => {
    return subscribeModIcon(slug, () => {
      const cached = getCachedModIcon(slug);
      if (cached !== undefined) setIconUrl(cached);
    });
  }, [slug]);

  useEffect(() => {
    // Already resolved (or known missing) — nothing to do.
    if (getCachedModIcon(slug) !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let disposed = false;

    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          void ensureModIcon(slug).then(url => {
            if (disposed) return;
            setIconUrl(url);
            // Transient failure — retry once after the cooldown so a network
            // hiccup doesn't leave a letter placeholder for the whole session.
            if (url === null && getCachedModIcon(slug) === undefined) {
              setTimeout(() => setRetryKey(k => k + 1), RETRY_DELAY_MS);
            }
          });
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);

    return () => {
      disposed = true;
      io.disconnect();
    };
  }, [slug, retryKey]);

  return (
    <span ref={ref} className="inline-flex flex-shrink-0">
      <ModIcon iconUrl={iconUrl ?? null} name={name} size={size} dimmed={dimmed} className={className} />
    </span>
  );
}
