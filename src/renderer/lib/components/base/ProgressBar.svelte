<!-- Determinate progress bar — push/export/initial-setup progress. -->
<script lang="ts">
  interface Props {
    /** 0–100. Clamped. */
    percent: number;
    /** Fill color (any CSS color; defaults to the primary token). */
    color?: string;
    heightClass?: string;
  }

  let { percent, color = 'rgb(var(--color-primary))', heightClass = 'h-1.5' }: Props = $props();

  const clamped = $derived(Math.min(100, Math.max(0, percent)));
</script>

<div class="w-full rounded-full overflow-hidden bg-line/15 {heightClass}">
  <div
    class="h-full rounded-full transition-[width] duration-300 ease-out"
    style="width: {clamped}%; background: {color};"
  ></div>
</div>
