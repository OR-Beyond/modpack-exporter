<!--
  Mod thumbnail with a letter placeholder fallback.
  Single implementation — used by ActivityFeed, PushModal and PullResultPopup.
-->
<script lang="ts">
  export type ModIconSize = 'sm' | 'md' | 'lg';

  interface Props {
    iconUrl: string | null;
    name: string;
    size?: ModIconSize;
    /** Removed mods render dimmed. */
    dimmed?: boolean;
    class?: string;
  }

  const SIZE_CLASSES: Record<ModIconSize, string> = {
    sm: 'w-6 h-6 rounded-[4px] text-xs',
    md: 'w-7 h-7 rounded-[4px] text-sm',
    lg: 'w-10 h-10 rounded-md text-base',
  };

  let { iconUrl, name, size = 'md', dimmed = false, class: className = '' }: Props = $props();

  let failed = $state(false);
  const letter = $derived((name || '?')[0].toUpperCase());
  const showPlaceholder = $derived(!iconUrl || failed);
</script>

{#if showPlaceholder}
  <div
    class="flex items-center justify-center font-bold select-none flex-shrink-0 bg-subtle border border-line/12 text-muted {SIZE_CLASSES[
      size
    ]} {dimmed ? 'opacity-60' : ''} {className}"
    aria-hidden="true"
  >
    {letter}
  </div>
{:else}
  <img
    src={iconUrl}
    loading="lazy"
    alt={name}
    onerror={() => (failed = true)}
    class="flex-shrink-0 object-cover {SIZE_CLASSES[size]} {dimmed ? 'opacity-60' : ''} {className}"
  />
{/if}
