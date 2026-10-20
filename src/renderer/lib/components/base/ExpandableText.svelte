<!--
  Truncates long content with a CSS line-clamp and shows a
  "Show more"/"Show less" toggle only when the content actually overflows
  (measured via scrollHeight > clientHeight). Safe to use inside flex rows.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';

  interface Props {
    /** Plain text content. Prefer over children when no rich content is needed. */
    text?: string;
    /** Rich content. Takes precedence over `text` when both are given. */
    children?: Snippet;
    /** Max visible lines before the toggle appears. Default: 3. */
    lines?: number;
    class?: string;
  }

  let { text, children, lines = 3, class: className = '' }: Props = $props();

  let expanded = $state(false);
  let needsToggle = $state(false);
  let el: HTMLDivElement | undefined = $state();

  // Overflow only means something while collapsed: skip measuring when the
  // text is expanded, then re-measure once it collapses again.
  $effect(() => {
    if (expanded) return;
    const node = el;
    if (!node) return;
    const measure = () => {
      needsToggle = node.scrollHeight > node.clientHeight + 1;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  });

  const clampStyle = $derived(
    expanded || !needsToggle
      ? undefined
      : `display: -webkit-box; -webkit-line-clamp: ${lines}; -webkit-box-orient: vertical; overflow: hidden;`,
  );
</script>

<div class="min-w-0 {className}">
  <div bind:this={el} class="text-inherit break-words" style={clampStyle}>
    {#if children}{@render children()}{:else if text != null}{text}{/if}
  </div>
  {#if needsToggle}
    <button
      type="button"
      onclick={() => (expanded = !expanded)}
      class="mt-1 flex items-center gap-0.5 text-xs font-medium text-muted hover:text-foreground transition-colors select-none"
    >
      {#if expanded}<ChevronUp size={12} />{:else}<ChevronDown size={12} />{/if}
      {expanded ? 'Show less' : 'Show more'}
    </button>
  {/if}
</div>
