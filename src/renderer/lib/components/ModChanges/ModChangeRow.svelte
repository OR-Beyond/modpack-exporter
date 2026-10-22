<script lang="ts">
  import ModIcon from '../common/ModIcon.svelte';

  interface Props {
    name: string;
    iconUrl: string | null;
    status: 'added' | 'updated' | 'removed';
    version?: string | null;
    oldVersion?: string | null;
    fileName?: string | null;
  }
  let { name, iconUrl, status, version = null, oldVersion = null, fileName = null }: Props = $props();

  const label = $derived(status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : 'Updated');
</script>

<div class="flex items-center gap-2 min-w-0 py-1">
  <ModIcon {iconUrl} {name} size="sm" />
  <div class="min-w-0 flex-1">
    <div class="text-xs text-foreground truncate">{name}</div>
    {#if fileName}<div class="text-[10px] text-muted-foreground truncate">{fileName}</div>{/if}
  </div>
  <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
  {#if version}
    <span class="text-xs font-mono flex-shrink-0 text-muted-foreground">
      {#if oldVersion}{oldVersion} → {/if}{version}
    </span>
  {/if}
</div>
