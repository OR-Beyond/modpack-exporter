<!--
  Platform-aware window control buttons.
  macOS: traffic-light circles (left). Windows/Linux: minimize + close icons.
  Drag region is handled by the parent — buttons are explicitly `no-drag`.
-->
<script lang="ts">
  import Minus from '@lucide/svelte/icons/minus';
  import X from '@lucide/svelte/icons/x';
  import { ipc } from '../ipc';

  const MAC_TRAFFIC_LIGHT_COLORS = {
    close: '#E24729',
    minimize: '#FFBD2E',
    zoom: '#28C840',
  };

  const isMac = ipc.platform === 'darwin';
</script>

{#if isMac}
  <div class="flex items-center gap-1 pl-2 pr-3 no-drag">
    <button
      onclick={() => ipc.app.close()}
      class="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:brightness-75 transition-all"
      style="background: {MAC_TRAFFIC_LIGHT_COLORS.close};"
      aria-label="Close"
      title="Close"
    ></button>
    <button
      onclick={() => ipc.app.minimize()}
      class="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:brightness-75 transition-all"
      style="background: {MAC_TRAFFIC_LIGHT_COLORS.minimize};"
      aria-label="Minimize"
      title="Minimize"
    ></button>
    <div
      class="w-3.5 h-3.5 rounded-full"
      style="background: {MAC_TRAFFIC_LIGHT_COLORS.zoom};"
      aria-hidden="true"
    ></div>
  </div>
{:else}
  <div class="flex items-center gap-0.5 no-drag">
    <button
      onclick={() => ipc.app.minimize()}
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-line/10 transition-colors"
      aria-label="Minimize"
    >
      <Minus size={13} class="text-muted" />
    </button>
    <button
      onclick={() => ipc.app.close()}
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-brand transition-colors"
      aria-label="Close"
    >
      <X size={13} class="text-muted" />
    </button>
  </div>
{/if}
