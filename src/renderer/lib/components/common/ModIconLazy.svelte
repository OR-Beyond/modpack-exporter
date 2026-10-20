<!--
  Lazy mod icon — defers the Modrinth icon lookup until the element approaches
  the viewport (IntersectionObserver), so long commit feeds don't fire a burst
  of IPC requests up front. Subscribes to the modIcons cache so icons that
  resolve later (prefetch, retry after a transient failure) re-render in place;
  renders the ModIcon letter placeholder while pending.
-->
<script lang="ts">
  import ModIcon, { type ModIconSize } from './ModIcon.svelte';
  import { ensureModIcon, getCachedModIcon, subscribeModIcon } from '../../utils/modIcons';

  interface Props {
    slug: string;
    name: string;
    size?: ModIconSize;
    /** Removed mods render dimmed. */
    dimmed?: boolean;
    class?: string;
  }

  const RETRY_DELAY_MS = 15_000;

  let { slug, name, size = 'md', dimmed = false, class: className = '' }: Props = $props();

  let iconUrl = $state<string | null | undefined>(undefined);
  let el: HTMLSpanElement | undefined = $state();
  let retryKey = $state(0);

  // Seed from cache and re-render when the cache resolves this slug
  // (prefetch or retry success).
  $effect(() => {
    const currentSlug = slug;
    iconUrl = getCachedModIcon(currentSlug);
    return subscribeModIcon(currentSlug, () => {
      const cached = getCachedModIcon(currentSlug);
      if (cached !== undefined) iconUrl = cached;
    });
  });

  $effect(() => {
    // Track slug + retryKey so the observer re-arms on change.
    void slug;
    void retryKey;
    // Already resolved (or known missing) — nothing to do.
    if (getCachedModIcon(slug) !== undefined) return;
    const node = el;
    if (!node) return;
    let disposed = false;

    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          void ensureModIcon(slug).then(url => {
            if (disposed) return;
            iconUrl = url;
            // Transient failure — retry once after the cooldown so a network
            // hiccup doesn't leave a letter placeholder for the whole session.
            if (url === null && getCachedModIcon(slug) === undefined) {
              setTimeout(() => (retryKey += 1), RETRY_DELAY_MS);
            }
          });
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(node);

    return () => {
      disposed = true;
      io.disconnect();
    };
  });
</script>

<span bind:this={el} class="inline-flex flex-shrink-0">
  <ModIcon iconUrl={iconUrl ?? null} {name} {size} {dimmed} class={className} />
</span>
