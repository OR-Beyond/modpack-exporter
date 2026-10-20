<!--
  Shared modal shell — overlay, backdrop dismissal (mouse-down/up on the
  overlay itself, so a drag that ends outside doesn't dismiss), rounded panel.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    /** Called when the user dismisses (backdrop click or close button). */
    onClose: () => void;
    /** When false (or while `locked`), backdrop/close dismissal is disabled. */
    dismissible?: boolean;
    /** Busy phase — hides the close button and blocks backdrop dismissal. */
    locked?: boolean;
    /** Tailwind width class for the panel (defaults to w-[480px]). */
    widthClass?: string;
    children?: Snippet;
  }

  let {
    open,
    onClose,
    dismissible = true,
    locked = false,
    widthClass = 'w-[480px]',
    children,
  }: Props = $props();

  let mouseDownTarget: EventTarget | null = null;

  const canDismiss = $derived(dismissible && !locked);

  function handleMouseDown(e: MouseEvent) {
    mouseDownTarget = e.target;
  }

  function handleMouseUp(e: MouseEvent) {
    if (canDismiss && mouseDownTarget === e.target && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownTarget = null;
  }
</script>

{#if open}
  <div
    class="fixed inset-0 flex items-center justify-center z-50 bg-overlay/75"
    role="presentation"
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
  >
    <div
      class="{widthClass} flex flex-col max-h-[min(92vh,820px)] rounded-xl overflow-hidden shadow-2xl bg-card border border-line-strong"
    >
      {@render children?.()}
    </div>
  </div>
{/if}
