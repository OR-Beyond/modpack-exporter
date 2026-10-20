<!-- Labeled group of rows in a result list (pull/push/export summaries). -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Badge, { type BadgeTone } from '../base/Badge.svelte';

  interface Props {
    /** Badge label + count (e.g. "Updated · 3"). */
    label: string;
    count: number;
    tone?: BadgeTone;
    children?: Snippet;
  }

  let { label, count, tone = 'neutral', children }: Props = $props();
</script>

{#if count !== 0}
  <div class="flex flex-col gap-2.5">
    <Badge {tone}>
      {label} · {count}
    </Badge>
    <div class="flex flex-col gap-2">{@render children?.()}</div>
  </div>
{/if}
