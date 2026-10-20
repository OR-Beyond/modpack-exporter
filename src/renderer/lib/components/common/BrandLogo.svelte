<!-- ORB brand tile — the triplicated logo gradient, defined once. -->
<script lang="ts">
  import type { Component } from 'svelte';
  import Package from '@lucide/svelte/icons/package';

  interface Props {
    /** Size class for the tile (e.g. "w-9 h-9"). */
    sizeClass?: string;
    /** Icon rendered inside the gradient tile (defaults to Package). */
    icon?: Component<{ size?: number; class?: string }>;
    /** Icon size in px (defaults to 15 for a 36px tile). */
    iconSize?: number;
    /** Rounded corners class (defaults to rounded-xl). */
    roundedClass?: string;
  }

  let {
    sizeClass = 'w-9 h-9',
    icon: Icon = Package,
    iconSize = 15,
    roundedClass = 'rounded-xl',
  }: Props = $props();
</script>

<div
  class="flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-brand to-brand-end {sizeClass} {roundedClass}"
>
  <Icon size={iconSize} class="text-on-accent" />
</div>
