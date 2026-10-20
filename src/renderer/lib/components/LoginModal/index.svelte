<!--
  GitHub device-flow sign-in modal.
  Starts the flow on mount, shows the user code + countdown, and reports
  success back to the parent.
-->
<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Check from '@lucide/svelte/icons/check';
  import AlertCircle from '@lucide/svelte/icons/circle-alert';
  import type { DeviceCodeInfo } from '../../types';
  import Modal from '../base/Modal.svelte';
  import ModalHeader from '../base/ModalHeader.svelte';
  import Button from '../base/Button.svelte';
  import GithubIcon from '../common/GithubIcon.svelte';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';

  interface Props {
    /** Closes the modal. If the device flow is still pending, this also aborts it. */
    onClose: () => void;
    /** Called after the device flow succeeds and the token is stored. */
    onSuccess: () => void;
  }

  type Status = 'requesting' | 'waiting' | 'success' | 'error';

  let { onClose, onSuccess }: Props = $props();

  let status = $state<Status>('requesting');
  let codeInfo = $state<DeviceCodeInfo | null>(null);
  let error = $state<string | null>(null);
  let secondsLeft = $state<number | null>(null);

  // Track unmount so async resolves don't update state
  let cancelled = false;

  // ── Start the device flow on mount ─────────────────────────────────────────
  $effect(() => {
    cancelled = false;

    const unsub = ipc.auth.onDeviceCode(info => {
      if (cancelled) return;
      codeInfo = info;
      status = 'waiting';
      secondsLeft = info.expires_in;
      // Auto-open the verification page in the default browser
      ipc.app.openExternal(info.verification_uri).catch(() => {});
    });

    ipc.auth
      .start()
      .then(result => {
        if (cancelled) return;
        if (result.success) {
          status = 'success';
          // Brief success state, then notify parent
          setTimeout(() => {
            if (!cancelled) onSuccess();
          }, 800);
        } else {
          status = 'error';
          error = result.error || 'Authentication failed';
        }
      })
      .catch(e => {
        if (cancelled) return;
        status = 'error';
        error = e?.message || String(e);
      });

    return () => {
      cancelled = true;
      unsub();
    };
  });

  // ── Countdown ──────────────────────────────────────────────────────────────
  $effect(() => {
    if (secondsLeft === null || status !== 'waiting') return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => (secondsLeft = secondsLeft !== null && secondsLeft > 0 ? secondsLeft - 1 : 0), 1000);
    return () => clearInterval(t);
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleCancel() {
    cancelled = true;
    await ipc.auth.logout().catch(() => {});
    onClose();
  }

  async function handleCopy() {
    if (!codeInfo) return;
    try {
      await navigator.clipboard.writeText(codeInfo.user_code);
      toast.success('Code copied to clipboard');
    } catch {
      toast.error('Could not copy code');
    }
  }

  function handleOpenBrowser() {
    if (!codeInfo) return;
    ipc.app.openExternal(codeInfo.verification_uri).catch(() => {});
  }

  function formatExpiry(s: number): string {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
</script>

<Modal open onClose={handleCancel} dismissible={false} widthClass="w-[440px]">
  <ModalHeader onClose={handleCancel} locked={status === 'success'}>
    <div class="flex items-center gap-2">
      <GithubIcon size={16} class="text-foreground" />
      <h2 class="text-foreground font-semibold text-base">Sign in to GitHub</h2>
    </div>
  </ModalHeader>

  <!-- Body -->
  <div class="p-6">
    {#if status === 'requesting'}
      <div class="flex flex-col items-center gap-3 py-8">
        <Loader2 size={28} class="animate-spin text-muted" />
        <p class="text-muted text-sm">Requesting device code…</p>
      </div>
    {/if}

    {#if status === 'waiting' && codeInfo}
      <p class="text-muted text-sm mb-5 leading-relaxed">
        Enter the code below at{' '}
        <button onclick={handleOpenBrowser} class="inline-flex items-center gap-0.5 hover:underline text-primary">
          {codeInfo.verification_uri.replace(/^https?:\/\//, '')}
          <ExternalLink size={11} />
        </button>{' '}
        to authorize this app.
      </p>

      <!-- User code -->
      <div class="rounded-xl p-5 flex flex-col items-center gap-3 mb-5 bg-subtle border border-line/8">
        <span
          class="font-mono font-bold text-foreground tracking-[0.3em] select-text"
          style="font-size: 32px; line-height: 1.1;"
        >
          {codeInfo.user_code}
        </span>
        <button
          onclick={handleCopy}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-line/8 hover:bg-line/10 transition-colors"
        >
          <Copy size={12} />
          Copy code
        </button>
      </div>

      <!-- Status row -->
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-muted">
          <Loader2 size={12} class="animate-spin" />
          Waiting for approval…
        </div>
        {#if secondsLeft !== null && secondsLeft > 0}
          <span class="text-muted font-mono">{formatExpiry(secondsLeft)}</span>
        {/if}
      </div>
    {/if}

    {#if status === 'success'}
      <div class="flex flex-col items-center gap-3 py-8">
        <div class="w-12 h-12 rounded-full flex items-center justify-center bg-success/15">
          <Check size={24} class="text-success" />
        </div>
        <p class="text-foreground text-sm font-medium">Signed in successfully</p>
      </div>
    {/if}

    {#if status === 'error'}
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <div class="w-12 h-12 rounded-full flex items-center justify-center bg-brand/15">
          <AlertCircle size={24} class="text-brand" />
        </div>
        <p class="text-foreground text-sm font-medium">Sign-in failed</p>
        {#if error}<p class="text-muted text-xs max-w-[320px]">{error}</p>{/if}
        <Button variant="primary" class="mt-2" onclick={onClose}>Close</Button>
      </div>
    {/if}
  </div>

  <!-- Footer with cancel during wait -->
  {#if status === 'waiting'}
    <div class="flex items-center justify-between px-5 py-4 border-t border-line/6 flex-shrink-0">
      <button onclick={handleOpenBrowser} class="flex items-center gap-1.5 text-xs font-medium hover:underline text-primary">
        Open browser <ExternalLink size={11} />
      </button>
      <Button variant="ghost" size="sm" onclick={handleCancel}>Cancel</Button>
    </div>
  {/if}
</Modal>
