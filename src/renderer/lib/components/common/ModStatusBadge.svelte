<!--
  Per-mod status pill (added / updated / removed).
  Shared by the activity feed, push preview and pull result popup.
-->
<script lang="ts">
  import Badge from '../base/Badge.svelte';

  export type ModStatus = 'added' | 'updated' | 'removed';

  interface Props {
    status: ModStatus;
    /** Shown as "old → new" when status is updated and versions differ. */
    versionNumber?: string | null;
    oldVersionNumber?: string | null;
  }

  let { status, versionNumber, oldVersionNumber }: Props = $props();
</script>

{#if status === 'added'}
  <Badge tone="success">Added</Badge>
{:else if status === 'removed'}
  <Badge tone="danger">Removed</Badge>
{:else if oldVersionNumber && versionNumber && oldVersionNumber !== versionNumber}
  <span class="text-xs text-muted-foreground flex-shrink-0">
    {oldVersionNumber} → {versionNumber}
  </span>
{:else}
  <Badge tone="warning">Updated</Badge>
{/if}
