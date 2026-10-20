<!--
  Full-height panel shown in the dashboard body during first-run setup while the
  versions repo is cloned and the initial modpack pull downloads every mod +
  override. Replaces the empty ActivityFeed/Sidebar so the user is never left
  staring at a blank dashboard with no mods.
-->
<script lang="ts">
  import Download from '@lucide/svelte/icons/download';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Package from '@lucide/svelte/icons/package';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Button from '../base/Button.svelte';
  import BrandLogo from '../common/BrandLogo.svelte';

  export type InitState = 'cloning' | 'pulling' | 'error';

  export interface InitProgress {
    stage: string;
    message: string;
    percent: number;
  }

  interface Props {
    /** Current phase of first-run initialization. */
    state: InitState;
    /** Latest progress event from the pull (null while cloning / before first event). */
    progress: InitProgress | null;
    /** Error message when `state === 'error'`. */
    error: string | null;
    /** Retry the whole initialization (clone + pull) from the top. */
    onRetry: () => void;
  }

  let { state, progress, error, onRetry }: Props = $props();

  const isCloning = $derived(state === 'cloning');

  // While cloning we have no percentage — show an indeterminate bar. During the
  // pull we track the real percent reported by the sync:progress events.
  const percent = $derived(isCloning ? null : Math.max(0, Math.min(100, progress?.percent ?? 0)));

  const heading = $derived(isCloning ? 'Setting things up…' : 'Downloading modpack…');
  const subtext = $derived(
    isCloning
      ? 'Connecting to the versions repository.'
      : 'This may take a few minutes on first setup — grabbing every mod and override for your profile.',
  );
  const detail = $derived(
    isCloning ? 'Preparing versions repository' : progress?.message || 'Starting download…',
  );
</script>

{#if state === 'error'}
  <div class="flex flex-1 items-center justify-center overflow-hidden px-6">
    <div class="w-full max-w-[440px] rounded-xl p-7 flex flex-col items-center text-center shadow-2xl bg-card border border-danger/25">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-danger/10">
        <AlertTriangle size={22} class="text-danger" />
      </div>
      <h2 class="text-foreground font-semibold text-[17px] mb-1.5">Setup couldn’t finish</h2>
      <p class="text-muted text-sm leading-relaxed mb-1">
        We couldn’t download the modpack. Your files were not changed — you can safely retry.
      </p>
      {#if error}
        <p class="text-xs font-mono mt-2 mb-4 px-3 py-2 rounded-lg w-full break-words bg-subtle text-danger/90 border border-danger/20">
          {error}
        </p>
      {/if}
      <Button variant="primary" icon={RotateCw} class="mt-2" onclick={onRetry}>Retry setup</Button>
    </div>
  </div>
{:else}
  <div class="flex flex-1 items-center justify-center overflow-hidden px-6">
    <div class="w-full max-w-[460px] rounded-xl p-8 flex flex-col items-center text-center shadow-2xl bg-card border border-line/8">
      <!-- Icon badge -->
      <div class="mb-5">
        <BrandLogo sizeClass="w-14 h-14 rounded-[14px]" icon={isCloning ? Package : Download} iconSize={24} />
      </div>

      <h2 class="text-foreground font-semibold text-[18px] mb-2">{heading}</h2>
      <p class="text-muted text-sm leading-relaxed mb-6 max-w-[360px]">{subtext}</p>

      <!-- Progress bar -->
      <div class="w-full h-2 rounded-full overflow-hidden mb-3 relative bg-subtle">
        {#if percent === null}
          <!-- Indeterminate sweep while cloning -->
          <div class="absolute top-0 bottom-0 w-1/3 rounded-full initial-setup-indeterminate bg-gradient-to-r from-brand to-brand-end"></div>
        {:else}
          <div
            class="h-full rounded-full transition-[width] duration-300 ease-out bg-gradient-to-r from-brand to-brand-end"
            style="width: {percent}%;"
          ></div>
        {/if}
      </div>

      <!-- Live detail line -->
      <div class="flex items-center gap-2 text-xs text-muted min-h-[18px] w-full justify-center">
        <Loader2 size={12} class="animate-spin flex-shrink-0" />
        <span class="truncate" title={detail}>{detail}</span>
        {#if percent !== null}<span class="tabular-nums flex-shrink-0">· {percent}%</span>{/if}
      </div>
    </div>
  </div>
{/if}
