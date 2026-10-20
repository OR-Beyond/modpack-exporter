<!--
  Collapsible list of changed files (added/removed/changed) with dot indicators.
-->
<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';

  interface Props {
    all: { f: string; status: 'added' | 'removed' | 'changed' }[];
  }

  const FILE_COLLAPSE_LIMIT = 5;

  let { all }: Props = $props();

  let expanded = $state(false);

  const dotClass = { added: 'bg-success', removed: 'bg-brand', changed: 'bg-warning' };
  const visible = $derived(expanded ? all : all.slice(0, FILE_COLLAPSE_LIMIT));
  const hidden = $derived(all.length - FILE_COLLAPSE_LIMIT);
</script>

<div>
  <p class="text-[11px] font-semibold uppercase tracking-wide mb-1.5 text-muted-foreground">
    Changed Files ({all.length})
  </p>
  <div class="flex flex-col gap-1">
    {#each visible as { f, status } (f)}
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-[7px] h-[7px] rounded-full flex-shrink-0 inline-block {dotClass[status]}"></span>
        <span class="text-xs font-mono truncate text-foreground/80">{f}</span>
      </div>
    {/each}
    {#if !expanded && hidden > 0}
      <button
        class="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity text-link"
        onclick={() => (expanded = true)}
      >
        <ChevronDown size={11} />+{hidden} more file{hidden !== 1 ? 's' : ''}
      </button>
    {/if}
    {#if expanded && all.length > FILE_COLLAPSE_LIMIT}
      <button
        class="flex items-center gap-1 text-xs mt-0.5 hover:opacity-75 transition-opacity text-link"
        onclick={() => (expanded = false)}
      >
        <ChevronUp size={11} />Show less
      </button>
    {/if}
  </div>
</div>
