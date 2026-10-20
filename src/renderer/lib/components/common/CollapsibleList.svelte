<!-- Renders the first N items with a "Show all N" expander when there are more. -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  interface Props {
    items: T[];
    /** Renders a single item row. */
    renderItem: Snippet<[T, number]>;
    /** Stable key per item (defaults to the item index). */
    getKey?: (item: T, index: number) => string;
    /** How many rows are shown before "Show all". */
    limit?: number;
    class?: string;
  }

  let { items, renderItem, getKey, limit = 5, class: className = '' }: Props = $props();

  let expanded = $state(false);
  const visible = $derived(expanded ? items : items.slice(0, limit));
  const hidden = $derived(items.length - limit);
</script>

<div class={className}>
  {#each visible as item, i (getKey ? getKey(item, i) : i)}
    {@render renderItem(item, i)}
  {/each}
  {#if !expanded && hidden > 0}
    <button
      type="button"
      onclick={() => (expanded = true)}
      class="flex items-center gap-1 text-xs transition-opacity hover:opacity-75 text-muted"
    >
      <ChevronDown size={11} />
      Show all {items.length}
    </button>
  {/if}
</div>
