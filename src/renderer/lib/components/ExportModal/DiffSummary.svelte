<!--
  Visual diff summary for a changelog result: initial / no_changes / diff.
-->
<script lang="ts">
  import type { ChangelogDiff, ChangelogResult } from '../../types';
  import ModStatusBadge, { type ModStatus } from '../common/ModStatusBadge.svelte';
  import FileList from './FileList.svelte';

  interface Props {
    result: ChangelogResult;
  }

  let { result }: Props = $props();

  const d = $derived(result.type === 'diff' ? (result.diff as ChangelogDiff) : null);
  const hasAny = $derived(
    d
      ? d.addedMods.length +
          d.removedMods.length +
          d.updatedMods.length +
          d.addedFiles.length +
          d.removedFiles.length +
          d.changedFiles.length >
          0
      : false,
  );
  const allFiles = $derived(
    d
      ? [
          ...d.addedFiles.map(f => ({ f, status: 'added' as const })),
          ...d.removedFiles.map(f => ({ f, status: 'removed' as const })),
          ...d.changedFiles.map(f => ({ f, status: 'changed' as const })),
        ]
      : [],
  );
</script>

{#snippet dot(className: string)}
  <span class="w-[7px] h-[7px] rounded-full flex-shrink-0 inline-block {className}"></span>
{/snippet}

{#snippet modList(mods: { name: string }[], status: ModStatus, dotClass: string, labelClass: string, label: string)}
  {#if mods.length > 0}
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-wide mb-1.5 {labelClass}">
        {label} ({mods.length})
      </p>
      <div class="flex flex-col gap-1">
        {#each mods as m (m.name)}
          <div class="flex items-center gap-2 min-w-0">
            {@render dot(dotClass)}
            <span class="text-xs truncate text-foreground/80 flex-1">{m.name}</span>
            <ModStatusBadge {status} />
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#if result.type === 'initial'}
  <div class="rounded-lg px-3 py-2.5 text-xs leading-relaxed bg-success/10 border border-success/20 text-muted-foreground">
    Initial release — no previous version to compare.
  </div>
{:else if result.type === 'no_changes'}
  <div class="rounded-lg px-3 py-2.5 text-xs leading-relaxed bg-warning/10 border border-warning/20 text-muted-foreground">
    No changes since last release — version was already exported.
  </div>
{:else if d && !hasAny}
  <div class="rounded-lg px-3 py-2.5 text-xs bg-subtle border border-line/6 text-muted-foreground">
    No changes detected since v{d.from}.
  </div>
{:else if d}
  <div class="rounded-lg p-3 flex flex-col gap-3 bg-subtle border border-line/6">
    {#if d.from}
      <p class="text-[11px] text-muted-foreground">Comparing against v{d.from}</p>
    {/if}
    {@render modList(d.addedMods, 'added', 'bg-success', 'text-success', 'Added Mods')}
    {@render modList(d.removedMods, 'removed', 'bg-brand', 'text-brand', 'Removed Mods')}
    {@render modList(d.updatedMods, 'updated', 'bg-warning', 'text-warning', 'Updated Mods')}
    {#if allFiles.length > 0}
      <FileList all={allFiles} />
    {/if}
  </div>
{/if}
