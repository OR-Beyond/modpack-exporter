<!-- Text input with optional label and hint. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { FIELD_CLASSES, LABEL_CLASSES } from './fieldClasses';

  interface Props {
    label?: string;
    hint?: Snippet | string;
    class?: string;
    id?: string;
    value?: string;
    [key: string]: unknown;
  }

  let { label, hint, class: className = '', id, value = $bindable(), ...rest }: Props = $props();

  const inputId = $derived(
    id ?? (label ? `input-${label.toString().replace(/\s+/g, '-').toLowerCase()}` : undefined),
  );
</script>

<div class="flex flex-col gap-0">
  {#if label}
    <label for={inputId} class={LABEL_CLASSES}>{label}</label>
  {/if}
  <input id={inputId} class="{FIELD_CLASSES} {className}" bind:value {...rest} />
  {#if hint}
    <p class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
      {#if typeof hint === 'string'}{hint}{:else}{@render hint()}{/if}
    </p>
  {/if}
</div>
