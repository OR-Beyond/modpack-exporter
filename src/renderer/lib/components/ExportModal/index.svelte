<!--
  Export flow — version + output path, changelog generation/editing, .mrpack export.
-->
<script lang="ts">
  import AlertCircle from '@lucide/svelte/icons/circle-alert';
  import CheckCircle2 from '@lucide/svelte/icons/circle-check-big';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Package from '@lucide/svelte/icons/package';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Upload from '@lucide/svelte/icons/upload';
  import type { AppConfig, ChangelogDiff, ChangelogResult, MrpackErrorDetail } from '../../types';
  import Modal from '../base/Modal.svelte';
  import ModalHeader from '../base/ModalHeader.svelte';
  import ModalBody from '../base/ModalBody.svelte';
  import ModalFooter from '../base/ModalFooter.svelte';
  import Button from '../base/Button.svelte';
  import Input from '../base/Input.svelte';
  import { LABEL_CLASSES } from '../base/fieldClasses';
  import Textarea from '../base/Textarea.svelte';
  import ProgressBar from '../base/ProgressBar.svelte';
  import DiffSummary from './DiffSummary.svelte';
  import { bumpPatch, formatSize } from '../../utils/format';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';
  import { i18n } from '../../i18n/index.svelte';

  interface Props {
    config: AppConfig;
    onClose: () => void;
    onSuccess: () => void;
  }

  type Phase = 'form' | 'generating' | 'changelog' | 'exporting' | 'success' | 'error';

  interface ProgressState {
    stage: string;
    message: string;
    percent: number;
  }

  const FILE_COLLAPSE_LIMIT = 5;

  let { config, onClose, onSuccess }: Props = $props();

  let version = $state('');
  let versionNote = $state<string | null>(null);
  let outputPath = $state<string | null>(null);
  let phase = $state<Phase>('form');
  let progress = $state<ProgressState>({ stage: '', message: '', percent: 0 });
  let error = $state<string | null>(null);
  let errorDetail = $state<MrpackErrorDetail | null>(null);
  let fileSize = $state<number | null>(null);
  let published = $state(false);
  let changelogResult = $state<ChangelogResult | null>(null);
  let changelogText = $state('');
  let originalMarkdown = $state('');
  let overwriteSnapshot = $state(false);
  let includeFancyMenu = $state(true);
  let includeDefaultOptions = $state(true);

  // On mount: try Modrinth API first, fall back to local manifest
  $effect(() => {
    void (async () => {
      const projectId = (await ipc.settings.get('modrinthProjectId').catch(() => null)) || 'O5wGsyGR';

      const mr = await ipc.export
        .latestModrinthVersion(projectId)
        .catch(() => ({ version_number: null as null, reason: 'Network error' }));

      if (mr.version_number) {
        version = bumpPatch(mr.version_number);
        versionNote = null;
        return;
      }

      // Modrinth unavailable — fall back to local manifest version
      const mv = await ipc.export.manifestVersion().catch(() => ({ success: false, versionId: null as null }));
      if (mv.success && mv.versionId !== null) {
        version = String(mv.versionId + 1);
      } else {
        version = bumpPatch(config.version);
      }
      versionNote = mr.reason ?? 'Could not fetch latest Modrinth release. Using local version.';
    })();
  });

  const packName = $derived(config.pack_name);
  const defaultFilename = $derived(`${packName} ${version.trim() || '0.0.0'}.mrpack`);
  const isLocked = $derived(phase === 'generating' || phase === 'exporting');

  const barColor = $derived(
    phase === 'success'
      ? 'rgb(var(--color-success))'
      : phase === 'error'
        ? 'rgb(var(--color-danger))'
        : 'rgb(var(--color-link))',
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleChooseLocation() {
    const p = await ipc.export.saveDialog({ defaultPath: defaultFilename });
    if (p) outputPath = p;
  }

  async function handleGenerateChangelog() {
    error = null;
    progress = { stage: '', message: 'Starting…', percent: 0 };
    phase = 'generating';

    const unsub = ipc.export.onProgress(({ stage, message, percent }) => {
      progress = { stage, message, percent };
    });

    try {
      const r = await ipc.export.generateChangelog({ version: version.trim() });
      if (r.success) {
        changelogResult = r;
        changelogText = r.markdown;
        originalMarkdown = r.markdown;
        overwriteSnapshot = false;
        phase = 'changelog';
      } else {
        error = r.error ?? 'Failed to generate changelog';
        phase = 'error';
      }
    } catch (e: any) {
      error = e?.message ?? 'Unexpected error generating changelog';
      phase = 'error';
    } finally {
      unsub();
    }
  }

  function translated(key: string): string | null {
    const value = i18n.t(key);
    return value === key ? null : value;
  }

  function errorTitle(): string {
    if (!errorDetail) return error ?? '';
    const translatedTitle = translated(`errors.export.${errorDetail.code}`);
    return translatedTitle ?? errorDetail.detail ?? error ?? '';
  }

  function errorCauses(): string[] {
    const causes = errorDetail?.causes ?? (errorDetail?.cause ? [errorDetail.cause] : []);
    return causes.map(c => translated(`errors.export.cause.${c}`) ?? c.replace(/-/g, ' '));
  }

  async function handleExport() {
    if (!outputPath || !version.trim()) return;
    error = null;
    errorDetail = null;
    published = false;
    progress = { stage: '', message: 'Starting…', percent: 0 };
    phase = 'exporting';

    const unsub = ipc.export.onProgress(({ stage, message, percent }) => {
      progress = { stage, message, percent };
    });

    try {
      const r = await ipc.export.mrpack({
        outputPath,
        version: version.trim(),
        changelog: changelogText,
        overwriteSnapshot,
        includeFancyMenu,
        includeDefaultOptions,
      });
      if (r.success) {
        fileSize = r.size ?? null;
        published = !!r.published;
        phase = 'success';
        toast.success(
          r.published
            ? `Exported & published ${packName} ${version.trim()} to Modrinth`
            : `Exported ${packName} ${version.trim()}`,
        );
      } else {
        error = r.error ?? 'Export failed';
        errorDetail = r.errorDetail ?? null;
        phase = 'error';
      }
    } catch (e: any) {
      error = e?.message ?? 'Unexpected error during export';
      errorDetail = null;
      phase = 'error';
    } finally {
      unsub();
    }
  }

  function handleOpenFolder() {
    if (outputPath) ipc.app.showInFolder(outputPath);
  }

  function handleBack() {
    changelogResult = null;
    changelogText = '';
    originalMarkdown = '';
    phase = 'form';
  }

  function handleRetry() {
    error = null;
    phase = 'form';
  }
</script>

<Modal open onClose={onClose} dismissible={!isLocked} widthClass="w-[520px]">
  <ModalHeader onClose={onClose} locked={isLocked}>
    <h2 class="text-foreground font-semibold text-[15px]">
      {phase === 'changelog' ? `Changelog — v${version.trim()}` : 'Export .mrpack'}
    </h2>
  </ModalHeader>

  <ModalBody>
    <!-- ── form phase ── -->
    {#if phase === 'form'}
      <div class="p-5 flex flex-col gap-4">
        <div>
          <label class={LABEL_CLASSES} for="export-version">Version</label>
          <Input
            id="export-version"
            bind:value={version}
            placeholder={version === '' ? 'Loading…' : undefined}
            class="font-mono"
            hint={versionNote ?? undefined}
          />
        </div>

        <div>
          <label class={LABEL_CLASSES} for="export-output-file">Output file</label>
          {#if outputPath}
            <div class="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-subtle border border-line/6">
              <Package size={13} class="text-muted-foreground flex-shrink-0" />
              <span class="flex-1 text-xs font-mono truncate text-foreground/80" title={outputPath}>
                {outputPath}
              </span>
              <button
                onclick={handleChooseLocation}
                class="text-xs flex-shrink-0 hover:opacity-75 transition-opacity text-link"
              >
                Change
              </button>
            </div>
          {:else}
            <button
              onclick={handleChooseLocation}
              class="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors bg-subtle border border-dashed border-line/15 text-muted-foreground hover:border-link hover:text-link"
            >
              <FolderOpen size={14} />Choose location…
            </button>
          {/if}
        </div>

        <div class="flex flex-col gap-2.5 rounded-lg px-3 py-2.5 bg-subtle border border-line/6">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Include configs
          </p>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" bind:checked={includeFancyMenu} class="w-3.5 h-3.5 rounded accent-primary" />
            <span class="text-xs text-foreground/80">FancyMenu config</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" bind:checked={includeDefaultOptions} class="w-3.5 h-3.5 rounded accent-primary" />
            <span class="text-xs text-foreground/80">Default Options config</span>
          </label>
        </div>
      </div>
    {/if}

    <!-- ── generating phase ── -->
    {#if phase === 'generating'}
      <div class="p-6 flex flex-col gap-5">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-muted-foreground">Progress</span>
            <span class="text-xs font-mono tabular-nums text-link">{progress.percent}%</span>
          </div>
          <ProgressBar percent={progress.percent} color={barColor} />
        </div>
        <p class="text-sm text-center leading-relaxed text-muted-foreground">
          {progress.message || 'Starting…'}
        </p>
      </div>
    {/if}

    <!-- ── changelog phase ── -->
    {#if phase === 'changelog' && changelogResult}
      <div class="p-5 flex flex-col gap-4">
        <!-- Fallback warning: could not fetch from Modrinth -->
        {#if changelogResult.warning}
          <div class="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft/10 border border-warning-soft/25">
            <AlertCircle size={14} class="text-warning-soft mt-0.5 flex-shrink-0" />
            <p class="text-xs leading-relaxed text-warning-soft">{changelogResult.warning}</p>
          </div>
        {/if}
        <!-- Info note: e.g. "Mod changes since vX on Modrinth" -->
        {#if changelogResult.note && !changelogResult.warning}
          <div class="flex items-start gap-2.5 p-3 rounded-lg bg-link/10 border border-link/20">
            <p class="text-xs leading-relaxed text-link">{changelogResult.note}</p>
          </div>
        {/if}
        <!-- Visual diff summary -->
        <div>
          <p class="text-xs font-medium mb-2 text-muted-foreground">Changes detected</p>
          <DiffSummary result={changelogResult} />
        </div>

        <!-- Divider -->
        <div class="border-t border-line/6"></div>

        <!-- Editable changelog -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-medium text-muted-foreground" for="export-changelog-text">Changelog text</label>
            <button
              onclick={() => (changelogText = originalMarkdown)}
              disabled={changelogText === originalMarkdown}
              class="flex items-center gap-1 text-xs hover:opacity-75 transition-opacity disabled:opacity-30 text-link"
            >
              <RotateCcw size={10} />Reset
            </button>
          </div>
          <Textarea
            id="export-changelog-text"
            bind:value={changelogText}
            rows={11}
            class="text-xs font-mono"
            style="line-height: 1.6;"
            spellcheck={false}
          />
        </div>

        <!-- Snapshot-exists warning -->
        {#if changelogResult.snapshotExists}
          <div class="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft/10 border border-warning-soft/25">
            <AlertCircle size={14} class="text-warning-soft mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold mb-1 text-warning-soft">
                Release v{version.trim()} already has a snapshot
              </p>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" bind:checked={overwriteSnapshot} class="w-3.5 h-3.5 rounded accent-warning" />
                <span class="text-xs text-muted-foreground">Overwrite existing snapshot and changelog</span>
              </label>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── exporting phase ── -->
    {#if phase === 'exporting'}
      <div class="p-6 flex flex-col gap-5">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-muted-foreground">Progress</span>
            <span class="text-xs font-mono tabular-nums text-link">{progress.percent}%</span>
          </div>
          <ProgressBar percent={progress.percent} color={barColor} />
        </div>
        <p class="text-sm text-center leading-relaxed text-muted-foreground">
          {progress.message || 'Starting…'}
        </p>
      </div>
    {/if}

    <!-- ── success phase ── -->
    {#if phase === 'success'}
      <div class="p-6 flex flex-col gap-5">
        <div class="flex justify-center">
          <div class="w-12 h-12 rounded-full flex items-center justify-center bg-success/10 border border-success/25">
            <CheckCircle2 size={24} class="text-success" />
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-muted-foreground">Complete</span>
            <span class="text-xs font-mono tabular-nums text-success">100%</span>
          </div>
          <ProgressBar percent={100} color="rgb(var(--color-success))" />
        </div>
        <p class="text-sm text-center text-muted-foreground">Export complete!</p>
        {#if fileSize !== null}
          <div class="flex justify-center">
            <span class="text-xs px-3 py-1 rounded-full font-mono bg-success/10 text-success">
              {formatSize(fileSize)}
            </span>
          </div>
        {/if}
        {#if published}
          <div class="flex justify-center">
            <span class="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-mono bg-link/10 text-link border border-link/25">
              <Upload size={11} /> Published to Modrinth
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── error phase ── -->
    {#if phase === 'error' && error}
      <div class="p-5">
        <div class="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25">
          <AlertCircle size={14} class="text-danger mt-0.5 flex-shrink-0" />
          <div class="min-w-0">
            <p class="text-xs font-semibold mb-0.5 text-danger">Export failed</p>
            <p class="text-xs break-words leading-relaxed text-muted-foreground">{errorTitle()}</p>
            {#if errorCauses().length > 0}
              <ul class="mt-1.5 space-y-0.5 list-disc list-inside text-xs text-muted-foreground">
                {#each errorCauses() as cause (cause)}
                  <li>{cause}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </ModalBody>

  <!-- ── Footer ── -->
  <ModalFooter>
    {#if phase === 'form'}
      <Button variant="ghost" onclick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!version.trim() || !outputPath} onclick={handleGenerateChangelog}>
        Generate Changelog →
      </Button>
    {/if}

    {#if phase === 'generating'}
      <span class="px-4 py-2 text-sm text-muted-foreground">Generating…</span>
    {/if}

    {#if phase === 'changelog'}
      <Button variant="ghost" onclick={handleBack}>← Back</Button>
      <Button variant="primary" icon={Package} onclick={handleExport}>Export</Button>
    {/if}

    {#if phase === 'exporting'}
      <span class="px-4 py-2 text-sm text-muted-foreground">Exporting…</span>
    {/if}

    {#if phase === 'success'}
      <Button variant="ghost" icon={FolderOpen} onclick={handleOpenFolder}>Open Folder</Button>
      <button
        onclick={onSuccess}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-success hover:bg-success/10"
      >
        Done
      </button>
    {/if}

    {#if phase === 'error'}
      <Button variant="ghost" onclick={onClose}>Close</Button>
      <Button variant="primary" icon={Package} onclick={handleRetry}>Retry</Button>
    {/if}
  </ModalFooter>
</Modal>
