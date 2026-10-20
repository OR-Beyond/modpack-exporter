<!-- Modal body — scrollable content area. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto {className}">
  {@render children?.()}
</div>
