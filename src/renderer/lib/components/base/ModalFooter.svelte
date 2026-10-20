<!-- Modal footer — right-aligned action row. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-line/6 flex-shrink-0 {className}">
  {@render children?.()}
</div>
