<!-- Icon-only button with an accessible label. -->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  interface Props {
    /** Accessible name for the icon-only button. */
    label: string;
    icon: Component<{ size?: number; class?: string }>;
    iconSize?: number;
    variant?: 'ghost' | 'secondary';
    sizeClass?: string;
    class?: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  const VARIANT_CLASSES = {
    ghost: 'text-muted hover:bg-line/10',
    secondary: 'bg-card text-muted border border-line/8 hover:bg-line/10',
  } as const;

  let {
    label,
    icon: Icon,
    iconSize = 15,
    variant = 'ghost',
    sizeClass = 'w-7 h-7',
    class: className = '',
    disabled,
    onclick,
    ...rest
  }: Props = $props();
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
  class="inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring {sizeClass} {VARIANT_CLASSES[
    variant
  ]} {className}"
  {...rest}
>
  <Icon size={iconSize} />
</button>
