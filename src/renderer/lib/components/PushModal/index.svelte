<!--
  Push flow — preview changes, confirm, stream progress, auto-close on success.
-->
<script lang="ts">
  import AlertCircle from '@lucide/svelte/icons/circle-alert';
  import CheckCircle2 from '@lucide/svelte/icons/circle-check-big';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Upload from '@lucide/svelte/icons/upload';
  import type { PushedCommit, PushPreviewMod, PushPreviewResult, PushPreviewUpdate } from '../../types';
  import Modal from '../base/Modal.svelte';
  import ModalHeader from '../base/ModalHeader.svelte';
  import ModalFooter from '../base/ModalFooter.svelte';
  import Button from '../base/Button.svelte';
  import Textarea from '../base/Textarea.svelte';
  import ProgressBar from '../base/ProgressBar.svelte';
  import ModIcon from '../common/ModIcon.svelte';
  import ModStatusBadge from '../common/ModStatusBadge.svelte';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';
import { getCachedSetting } from '../../utils/settingsCache';

  interface Props {
    onClose: () => void;
    onSuccess: (commit?: PushedCommit) => void;
  }

  type Phase = 'idle' | 'confirming' | 'pushing' | 'success' | 'error';

  interface ProgressState {
    percent: number;
    message: string;
    stage: string;
  }

  let { onClose, onSuccess }: Props = $props();

  let commitMessage = $state('');
  let phase = $state<Phase>('idle');
  let progress = $state<ProgressState>({ percent: 0, message: '', stage: '' });
  let error = $state<string | null>(null);
  let countdown = $state(2);
  let preview = $state<PushPreviewResult | null>(null);
  let previewLoading = $state(true);
  let filesExpanded = $state(false);

  let pushedCommit: PushedCommit | undefined;

  // Load preview on mount
  $effect(() => {
    ipc.git
      .pushPreview()
      .then(r => {
        preview = r.success ? r : null;
        previewLoading = false;
      })
      .catch(() => (previewLoading = false));
  });

  // Auto-close 2s after success
  $effect(() => {
    if (phase !== 'success') return;
    countdown = 2;
    const interval = setInterval(() => {
      if (countdown <= 1) {
        clearInterval(interval);
        onSuccess(pushedCommit);
        countdown = 0;
        return;
      }
      countdown -= 1;
    }, 1000);
    return () => clearInterval(interval);
  });

  function handleRequestPush() {
    if (!commitMessage.trim()) {
      toast.error('Commit message required');
      return;
    }
    phase = 'confirming';
  }

  async function handleConfirmPush() {
    error = null;
    progress = { percent: 0, message: 'Starting…', stage: '' };
    phase = 'pushing';
    const unsub = ipc.git.onSyncProgress(data => {
      progress = { percent: data.percent ?? 0, message: data.message ?? '', stage: data.stage ?? '' };
    });
    try {
      const r = await ipc.git.push({ message: commitMessage.trim(), profile: { profilePath: getCachedSetting('modpackRoot') } });
      if (r.success) {
        pushedCommit = r.commit;
        progress = { percent: 100, message: 'Push complete!', stage: 'done' };
        phase = 'success';
        toast.success('Changes pushed successfully');
      } else {
        error = r.error ?? 'Push failed';
        phase = 'error';
      }
    } catch (e: any) {
      error = e?.message ?? 'Unexpected error';
      phase = 'error';
    } finally {
      unsub();
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const isPushing = $derived(phase === 'pushing');
  const isActive = $derived(phase === 'pushing' || phase === 'success');
  const barColor = $derived(
    phase === 'error'
      ? 'rgb(var(--color-danger))'
      : phase === 'success'
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-link))',
  );

  const hasChanges = $derived(
    !!preview &&
      (preview.addedMods.length > 0 ||
        preview.updatedMods.length > 0 ||
        preview.removedMods.length > 0 ||
        preview.changedFiles.length > 0),
  );

  const totalChanges = $derived(
    preview
      ? preview.addedMods.length + preview.updatedMods.length + preview.removedMods.length + preview.changedFiles.length
      : 0,
  );
</script>

{#snippet sectionHeader(title: string, colorClass: string, count: number)}
  <div class="flex items-center gap-2 mb-2">
    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 {colorClass}"></div>
    <span class="text-xs font-semibold {colorClass}">{title}</span>
    <span class="text-xs text-muted-foreground">({count})</span>
  </div>
{/snippet}

{#snippet addedModRow(mod: PushPreviewMod)}
  <div class="flex items-center gap-2 min-w-0">
    <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
    <span class="text-xs text-foreground truncate flex-1">{mod.name}</span>
    {#if mod.versionNumber}
      <span class="text-xs font-mono flex-shrink-0 text-success">{mod.versionNumber}</span>
    {/if}
    <ModStatusBadge status="added" />
  </div>
{/snippet}

{#snippet updatedModRow(mod: PushPreviewUpdate)}
  <div class="flex items-center gap-2 min-w-0">
    <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
    <span class="text-xs text-foreground truncate flex-1">{mod.name}</span>
    <div class="flex items-center gap-1 font-mono text-xs flex-shrink-0">
      {#if mod.oldVersionNumber}
        <span class="text-muted-foreground">{mod.oldVersionNumber}</span>
        <span class="text-muted-foreground">→</span>
      {/if}
      <span class="text-warning-soft">{mod.versionNumber ?? '?'}</span>
    </div>
    <ModStatusBadge status="updated" versionNumber={mod.versionNumber} oldVersionNumber={mod.oldVersionNumber} />
  </div>
{/snippet}

{#snippet removedModRow(mod: PushPreviewMod)}
  <div class="flex items-center gap-2 min-w-0">
    <ModIcon name={mod.name} iconUrl={mod.iconUrl} size="sm" />
    <span class="text-xs text-foreground truncate flex-1">{mod.name}</span>
    {#if mod.versionNumber}
      <span class="text-xs font-mono flex-shrink-0 text-danger">{mod.versionNumber}</span>
    {/if}
    <ModStatusBadge status="removed" />
  </div>
{/snippet}

<Modal open onClose={onClose} dismissible={phase === 'idle'} widthClass="w-[480px]">
  <ModalHeader onClose={onClose} locked={isPushing}>
    <div>
      <h2 class="text-foreground font-semibold text-[15px]">Push Changes</h2>
      <p class="text-xs mt-0.5 text-muted-foreground">Review and confirm changes before pushing</p>
    </div>
  </ModalHeader>

  <!-- Body: idle / error -->
  {#if phase === 'idle' || phase === 'error'}
    <div class="p-5 flex flex-col gap-4">
      <!-- Preview panel -->
      <div>
        <span class="block text-xs font-medium mb-1.5 text-muted">Preview</span>
        <div class="rounded-lg max-h-[260px] overflow-y-auto bg-subtle border border-line/6">
          {#if previewLoading}
            <div class="flex items-center gap-2.5 p-3.5 text-muted-foreground">
              <Loader2 size={13} class="animate-spin flex-shrink-0" />
              <span class="text-xs">Scanning for changes…</span>
            </div>
          {:else if !preview}
            <div class="p-3.5">
              <span class="text-xs text-muted-foreground">Could not load preview</span>
            </div>
          {:else if !hasChanges}
            <div class="flex items-center gap-2.5 p-3.5">
              <CheckCircle2 size={13} class="text-success flex-shrink-0" />
              <span class="text-xs text-muted-foreground">No changes to push — everything is in sync</span>
            </div>
          {:else}
            <div class="flex flex-col gap-4 p-3">
              <!-- Added mods -->
              {#if preview.addedMods.length > 0}
                <div>
                  {@render sectionHeader('Added Mods', 'text-success bg-success', preview.addedMods.length)}
                  <div class="flex flex-col gap-1.5 pl-3.5">
                    {#each preview.addedMods as mod (mod.slug)}
                      {@render addedModRow(mod)}
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Updated mods -->
              {#if preview.updatedMods.length > 0}
                <div>
                  {@render sectionHeader('Updated Mods', 'text-warning-soft bg-warning-soft', preview.updatedMods.length)}
                  <div class="flex flex-col gap-1.5 pl-3.5">
                    {#each preview.updatedMods as mod (mod.slug)}
                      {@render updatedModRow(mod)}
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Removed mods -->
              {#if preview.removedMods.length > 0}
                <div>
                  {@render sectionHeader('Removed Mods', 'text-danger bg-danger', preview.removedMods.length)}
                  <div class="flex flex-col gap-1.5 pl-3.5">
                    {#each preview.removedMods as mod (mod.slug)}
                      {@render removedModRow(mod)}
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Changed files — collapsible -->
              {#if preview.changedFiles.length > 0}
                <div>
                  <button
                    class="flex items-center gap-2 w-full mb-2 hover:opacity-75 transition-opacity"
                    onclick={() => (filesExpanded = !filesExpanded)}
                  >
                    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground"></div>
                    <span class="text-xs font-semibold text-muted-foreground">Changed Files</span>
                    <span class="text-xs text-muted-foreground">({preview.changedFiles.length})</span>
                    <ChevronRight
                      size={11}
                      class="ml-auto flex-shrink-0 transition-transform duration-200 text-muted-foreground {filesExpanded
                        ? 'rotate-90'
                        : ''}"
                    />
                  </button>
                  <div
                    style="display: grid; grid-template-rows: {filesExpanded ? '1fr' : '0fr'}; transition: grid-template-rows 200ms ease;"
                  >
                    <div class="overflow-hidden">
                      <div class="flex flex-col gap-1 pl-3.5 pb-0.5">
                        {#each preview.changedFiles as f (f.path)}
                          <div class="flex items-center gap-2 min-w-0">
                            <div
                              class="w-1 h-1 rounded-full flex-shrink-0 {f.status === 'added'
                                ? 'bg-success'
                                : f.status === 'removed'
                                  ? 'bg-danger'
                                  : 'bg-warning-soft'}"
                            ></div>
                            <span class="text-xs font-mono truncate text-muted-foreground">{f.path}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Unchanged count -->
              {#if preview.unchangedCount > 0}
                <p class="text-xs text-muted-foreground">
                  {preview.unchangedCount} mod{preview.unchangedCount !== 1 ? 's' : ''} unchanged
                </p>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Commit message -->
      <div>
        <label class="block text-xs font-medium mb-1.5 text-muted" for="push-commit-message">
          Commit message <span class="text-danger">*</span>
        </label>
        <Textarea
          id="push-commit-message"
          bind:value={commitMessage}
          placeholder="Describe what changed…"
          rows={3}
          style={phase === 'error' ? 'border-color: rgb(var(--color-danger) / 0.35);' : undefined}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRequestPush();
          }}
        />
      </div>

      <!-- Error banner -->
      {#if phase === 'error' && error}
        <div class="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25">
          <AlertCircle size={14} class="text-danger mt-0.5 flex-shrink-0" />
          <div class="min-w-0">
            <p class="text-xs font-semibold mb-0.5 text-danger">Push failed</p>
            <p class="text-xs break-words leading-relaxed text-muted-foreground">{error}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Body: pushing / success -->
  {#if isActive}
    <div class="p-6 flex flex-col gap-5">
      {#if phase === 'success'}
        <div class="flex justify-center">
          <div class="w-12 h-12 rounded-full flex items-center justify-center bg-success/10 border border-success/25">
            <CheckCircle2 size={24} class="text-success" />
          </div>
        </div>
      {/if}
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted-foreground">
            {phase === 'success' ? 'Complete' : 'Progress'}
          </span>
          <span class="text-xs font-mono tabular-nums {phase === 'success' ? 'text-success' : 'text-link'}">
            {progress.percent}%
          </span>
        </div>
        <ProgressBar percent={progress.percent} color={barColor} />
      </div>
      <p class="text-sm text-center leading-relaxed text-muted-foreground">
        {progress.message || 'Starting…'}
      </p>
      {#if phase === 'success'}
        <p class="text-xs text-center text-muted-foreground">Closing in {countdown}s…</p>
      {/if}
    </div>
  {/if}

  <!-- Footer -->
  <ModalFooter>
    {#if phase === 'idle'}
      <Button variant="ghost" onclick={onClose}>Cancel</Button>
      <Button variant="success" icon={Upload} disabled={!commitMessage.trim()} onclick={handleRequestPush}>
        Push
      </Button>
    {/if}

    {#if phase === 'confirming'}
      <div class="flex-1">
        <p class="text-xs leading-relaxed text-muted-foreground">
          This will commit <strong class="text-foreground">{commitMessage.trim()}</strong> and push
          <strong class="text-foreground">
            {' '}{hasChanges
              ? ` ${totalChanges} change${totalChanges !== 1 ? 's' : ''}`
              : ' all changes'}
          </strong> to the remote repository.
          All team members will see these changes after the next pull.
        </p>
      </div>
      <Button variant="ghost" onclick={() => (phase = 'idle')}>Go back</Button>
      <Button variant="success" icon={Upload} onclick={handleConfirmPush}>Confirm & Push</Button>
    {/if}

    {#if phase === 'pushing'}
      <span class="px-4 py-2 text-sm text-muted-foreground">Pushing…</span>
    {/if}

    {#if phase === 'success'}
      <button
        onclick={() => onSuccess(pushedCommit)}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-success hover:bg-success/10"
      >
        Done
      </button>
    {/if}

    {#if phase === 'error'}
      <Button variant="ghost" onclick={onClose}>Close</Button>
    {/if}
  </ModalFooter>
</Modal>
