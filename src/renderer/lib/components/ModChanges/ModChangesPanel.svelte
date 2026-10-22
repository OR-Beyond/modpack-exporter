<script lang="ts">
  import ModChangeRow from './ModChangeRow.svelte';

  interface Item {
    name: string;
    iconUrl: string | null;
    status: 'added' | 'updated' | 'removed';
    version?: string | null;
    oldVersion?: string | null;
    fileName?: string | null;
  }
  interface Props {
    items: Item[];
    variant?: 'pull' | 'push' | 'export';
    onConfirm?: () => void;
    onClose?: () => void;
  }
  let { items, variant = 'pull', onConfirm, onClose }: Props = $props();

  const added = $derived(items.filter(i => i.status === 'added'));
  const updated = $derived(items.filter(i => i.status === 'updated'));
  const removed = $derived(items.filter(i => i.status === 'removed'));
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-3 text-xs">
    <span>Added {added.length}</span>
    <span>Changed {updated.length}</span>
    <span>Removed {removed.length}</span>
  </div>
  <div class="max-h-80 overflow-auto">
    {#each items as item (item.name + item.status)}
      <ModChangeRow {...item} />
    {/each}
  </div>
  <div class="flex justify-end gap-2">
    {#if onClose}<button onclick={onClose} class="px-3 py-1 text-xs">Close</button>{/if}
    {#if onConfirm && variant !== 'pull'}<button onclick={onConfirm} class="px-3 py-1 text-xs">Confirm</button>{/if}
  </div>
</div>
