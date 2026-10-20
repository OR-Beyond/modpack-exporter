<!-- Modal header — optional close button on the right. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import IconButton from './IconButton.svelte';

  interface Props {
    children?: Snippet;
    /** When provided, renders a close button on the right. */
    onClose?: () => void;
    /** Hide the close button even when onClose is set (busy phases). */
    locked?: boolean;
  }

  let { children, onClose, locked = false }: Props = $props();
</script>

<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-line/6 flex-shrink-0">
  {@render children?.()}
  {#if onClose && !locked}
    <IconButton icon={X} label="Close" onclick={onClose} />
  {/if}
</div>
