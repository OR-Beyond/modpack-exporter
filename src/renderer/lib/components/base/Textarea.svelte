<!-- Textarea with optional label. -->
<script lang="ts">
  interface Props {
    label?: string;
    class?: string;
    id?: string;
    value?: string;
    [key: string]: unknown;
  }

  let { label, class: className = '', id, value = $bindable(), ...rest }: Props = $props();

  const inputId = $derived(
    id ?? (label ? `textarea-${label.toString().replace(/\s+/g, '-').toLowerCase()}` : undefined),
  );
</script>

<div class="flex flex-col gap-0">
  {#if label}
    <label for={inputId} class="block text-xs font-medium mb-1.5 text-muted">{label}</label>
  {/if}
  <textarea
    id={inputId}
    class="w-full rounded-lg px-3 py-2.5 text-sm resize-none bg-subtle border border-line/8 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring transition-all {className}"
    bind:value
    {...rest}
  ></textarea>
</div>
