<!-- Card surface — subtle = inset surface (inputs/preview panels), card = raised surface. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'card' | 'subtle';
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { variant = 'card', class: className = '', children, ...rest }: Props = $props();

  const variantClass = $derived(
    variant === 'subtle' ? 'bg-subtle border border-line/8' : 'bg-card border border-line/8',
  );
</script>

<div class="{variantClass} rounded-lg {className}" {...rest}>
  {@render children?.()}
</div>
