<!--
  Toast renderer — reproduces toast lib's bottom-right stack.

  Layout/animations mirror the original library: each toast is absolutely
  positioned at the bottom, offset upward by the heights of newer toasts, and
  animates in/out with the same cubic-bezier curves. State lives in
  `lib/state/toast.svelte.ts`.
-->
<script lang="ts">
  import { toastState, type ToastRecord } from '../../state/toast.svelte';

  const GUTTER = 8;

  const toasts = $derived(toastState.list);

  /** Offset (px) for a toast = sum of heights+gutter of all newer toasts. */
  function offsetFor(index: number): number {
    let offset = 0;
    for (let i = index + 1; i < toasts.length; i++) {
      offset += (toasts[i].height || 0) + GUTTER;
    }
    return offset;
  }

  function measure(node: HTMLElement, id: string) {
    const update = () => toastState.setHeight(id, node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
      },
    };
  }
</script>

<div class="toaster-container" aria-live="polite" aria-atomic="false">
  {#each toasts as t, i (t.id)}
    <div
      class="toast-wrapper"
      role="presentation"
      style="transform: translateY(-{offsetFor(i)}px);"
      onmouseenter={() => toastState.pause(t.id)}
      onmouseleave={() => toastState.resume(t.id)}
    >
      <div class="toast-bar" class:dismissed={t.dismissed} use:measure={t.id}>
        {#if t.type === 'loading'}
          <div class="toast-spinner"></div>
        {:else if t.type === 'success'}
          <div class="toast-icon toast-icon-success">
            <div class="toast-icon-after"></div>
          </div>
        {:else if t.type === 'error'}
          <div class="toast-icon toast-icon-error">
            <div class="toast-icon-after"></div>
            <div class="toast-icon-before"></div>
          </div>
        {:else if t.icon}
          <div class="toast-custom-icon">{t.icon}</div>
        {/if}
        <div class="toast-message" role="status">{t.message}</div>
      </div>
    </div>
  {/each}
</div>

<style>
  .toaster-container {
    position: fixed;
    z-index: 9999;
    top: 16px;
    left: 16px;
    right: 16px;
    bottom: 16px;
    pointer-events: none;
  }

  .toast-wrapper {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    transition: all 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
  }

  .toast-bar {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    max-width: 350px;
    border-radius: 8px;
    box-shadow:
      0 3px 10px rgba(0, 0, 0, 0.1),
      0 3px 3px rgba(0, 0, 0, 0.05);
    line-height: 1.3;
    background: rgb(var(--color-card));
    color: rgb(var(--color-foreground));
    border: 1px solid rgb(var(--color-line) / 0.08);
    font-size: 13px;
    pointer-events: auto;
    animation: toast-enter 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
  }

  .toast-bar.dismissed {
    animation: toast-exit 0.4s cubic-bezier(0.06, 0.71, 0.55, 1) forwards;
  }

  @keyframes toast-enter {
    0% {
      transform: translate3d(0, 200%, 0) scale(0.6);
      opacity: 0.5;
    }
    100% {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 1;
    }
  }

  @keyframes toast-exit {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate3d(0, 150%, -1px) scale(0.6);
      opacity: 0;
    }
  }

  .toast-message {
    margin: 4px 10px;
    flex: 1;
    white-space: pre-line;
  }

  .toast-spinner {
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    border: 2px solid #e0e0e0;
    border-radius: 100%;
    border-right-color: #616161;
    animation: toast-spin 1s linear infinite;
  }

  @keyframes toast-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .toast-icon {
    width: 20px;
    height: 20px;
    border-radius: 10px;
    position: relative;
    transform: rotate(45deg);
    animation: toast-icon-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    animation-delay: 100ms;
    opacity: 0;
  }

  .toast-icon-success {
    background: rgb(var(--color-success));
  }

  .toast-icon-error {
    background: rgb(var(--color-danger));
  }

  @keyframes toast-icon-in {
    from {
      transform: scale(0) rotate(45deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(45deg);
      opacity: 1;
    }
  }

  .toast-icon-after,
  .toast-icon-before {
    content: '';
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: rgb(var(--color-card));
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
    animation: toast-bar-grow 0.15s ease-out forwards;
    animation-delay: 150ms;
  }

  .toast-icon-before {
    animation: toast-bar-rotate 0.15s ease-out forwards;
    animation-delay: 180ms;
  }

  @keyframes toast-bar-grow {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes toast-bar-rotate {
    from {
      transform: scale(0) rotate(90deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(90deg);
      opacity: 1;
    }
  }

  .toast-custom-icon {
    animation: toast-icon-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    animation-delay: 120ms;
    opacity: 0;
  }
</style>
