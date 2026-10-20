<!-- Small status pill — added/updated/removed/file badges, section counts, tags. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

  interface Props {
    tone?: BadgeTone;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  }

  const TONE_CLASSES: Record<BadgeTone, string> = {
    neutral: 'bg-line/10 text-muted-foreground border border-line/8',
    success: 'bg-success/10 text-success border border-success/25',
    warning: 'bg-warning/10 text-warning-soft border border-warning/25',
    danger: 'bg-danger/10 text-danger border border-danger/25',
    info: 'bg-link/10 text-link border border-link/25',
  };

  let { tone = 'neutral', class: className = '', children, ...rest }: Props = $props();
</script>

<span
  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap {TONE_CLASSES[
    tone
  ]} {className}"
  {...rest}
>
  {@render children?.()}
</span>
