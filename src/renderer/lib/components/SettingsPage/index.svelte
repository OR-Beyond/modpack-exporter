<!--
  Settings page — exporter + modpack configuration, theme picker, defaults import.
-->
<script lang="ts">
  import Send from '@lucide/svelte/icons/send';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Settings2 from '@lucide/svelte/icons/settings-2';
  import Package from '@lucide/svelte/icons/package';
  import type { Component } from 'svelte';
  import ProfileSelector from '../SettingsModal/ProfileSelector.svelte';
  import { getCachedSetting, setCachedSetting } from '../../utils/settingsCache';
  import { themeState } from '../../state/theme.svelte';
  import { THEMES } from '../../theme/themes';
  import { formatSize, formatTimestamp } from '../../utils/format';
  import type { DefaultFileType, DefaultOptionsState } from '../../types';
  import Badge from '../base/Badge.svelte';
  import Button from '../base/Button.svelte';
  import Card from '../base/Card.svelte';
  import Input from '../base/Input.svelte';
  import { LABEL_CLASSES } from '../base/fieldClasses';
  import IconButton from '../base/IconButton.svelte';
  import Toggle from '../base/Toggle.svelte';
  import ConfirmDialog from '../ConfirmDialog.svelte';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';

  interface Props {
    onBack: () => void;
    onSaved: () => void;
  }

  const DEFAULT_OPTIONS_ROWS: { fileType: DefaultFileType; label: string }[] = [
    { fileType: 'options', label: 'Options' },
    { fileType: 'keybindings', label: 'Keybinds' },
    { fileType: 'servers', label: 'Servers' },
  ];

  let { onBack, onSaved }: Props = $props();

  let modpackRoot = $state('');
  let exportDir = $state('');
  let discordWebhook = $state('');
  let modrinthProjectId = $state('O5wGsyGR');
  let modrinthToken = $state('');
  let minecraftVersion = $state('1.21.1');
  let fabricLoaderVersion = $state('0.16.9');
  let isSaving = $state(false);
  let isTestingWebhook = $state(false);
  let hasChanges = $state(false);
  let readOnlyEnabled = $state(false);
  let autoSyncEnabled = $state(false);
  let defaultsState = $state<DefaultOptionsState | null>(null);
  let importingFile = $state<DefaultFileType | null>(null);
  let confirmReplace = $state<DefaultFileType | null>(null);

  async function refreshDefaults() {
    try {
      defaultsState = await ipc.defaults.getState();
    } catch {
      defaultsState = null;
    }
  }

  $effect(() => {
    void refreshDefaults();
  });

  async function handleDefaultImport(fileType: DefaultFileType) {
    importingFile = fileType;
    try {
      const r = await ipc.defaults.import(fileType);
      if (r.success) {
        toast.success(`Imported ${r.fileName}`);
        await refreshDefaults();
      } else {
        toast.error(r.error ?? 'Import failed');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed');
    } finally {
      importingFile = null;
    }
  }

  function handleDefaultImportClick(fileType: DefaultFileType) {
    const state = defaultsState?.[fileType];
    if (state?.exists) {
      confirmReplace = fileType;
    } else {
      void handleDefaultImport(fileType);
    }
  }

  const hasAnyDefaults = $derived(
    defaultsState !== null &&
      DEFAULT_OPTIONS_ROWS.some(({ fileType }) => {
        const s = defaultsState![fileType];
        return s.localExists || s.exists;
      }),
  );

  $effect(() => {
    modpackRoot = getCachedSetting('modpackRoot');
    exportDir = getCachedSetting('exportDir');
    discordWebhook = getCachedSetting('discordWebhook');
    modrinthProjectId = getCachedSetting('modrinthProjectId') || 'O5wGsyGR';
    modrinthToken = getCachedSetting('modrinthToken');
    minecraftVersion = getCachedSetting('minecraftVersion') || '1.21.1';
    fabricLoaderVersion = getCachedSetting('fabricLoaderVersion') || '0.16.9';

    void ipc.settings.getReadOnly().then(v => (readOnlyEnabled = v));
    void ipc.settings.getAutoSyncOnLaunch().then(v => (autoSyncEnabled = v));
  });

  function handleProfileSelected(path: string) {
    modpackRoot = path;
    hasChanges = true;
  }

  async function selectExportDir() {
    const dir = await ipc.app.selectDirectory();
    if (dir) {
      exportDir = dir;
      hasChanges = true;
    }
  }

  async function handleReadOnlyToggle() {
    const next = !readOnlyEnabled;
    readOnlyEnabled = next;
    await ipc.settings.setReadOnly(next);
    toast(next ? 'Read-only mode enabled' : 'Read-only mode disabled');
  }

  async function handleAutoSyncToggle() {
    const next = !autoSyncEnabled;
    autoSyncEnabled = next;
    await ipc.settings.setAutoSyncOnLaunch(next);
    toast(next ? 'Auto-sync on launch enabled' : 'Auto-sync on launch disabled');
  }

  async function handleTestWebhook() {
    if (!discordWebhook.trim()) {
      toast.error('Enter a webhook URL first');
      return;
    }
    isTestingWebhook = true;
    const r = await ipc.settings.testWebhook(discordWebhook.trim());
    isTestingWebhook = false;
    if (r.success) toast.success('Test message sent!');
    else toast.error(`Webhook test failed: ${r.error}`);
  }

  async function handleSave() {
    isSaving = true;
    await Promise.all([
      setCachedSetting('modpackRoot', modpackRoot.trim()),
      setCachedSetting('exportDir', exportDir.trim()),
      setCachedSetting('discordWebhook', discordWebhook.trim()),
      setCachedSetting('modrinthProjectId', modrinthProjectId.trim() || 'O5wGsyGR'),
      setCachedSetting('modrinthToken', modrinthToken.trim()),
      setCachedSetting('minecraftVersion', minecraftVersion.trim() || '1.21.1'),
      setCachedSetting('fabricLoaderVersion', fabricLoaderVersion.trim() || '0.16.9'),
    ]);
    isSaving = false;
    hasChanges = false;
    toast.success('Settings saved');
    onSaved();
  }

  const confirmRow = $derived(
    confirmReplace ? DEFAULT_OPTIONS_ROWS.find(r => r.fileType === confirmReplace) : undefined,
  );
  const confirmState = $derived(confirmReplace ? defaultsState?.[confirmReplace] : undefined);
  const confirmIdentical = $derived(
    !!confirmState?.localSha256 && !!confirmState?.sha256 && confirmState.localSha256 === confirmState.sha256,
  );
  const confirmDescription = $derived(
    confirmIdentical
      ? `This file is identical to what's already published in the repository — importing it will not change anything. Only your local copy will be removed.`
      : `This will replace the team's shipped ${confirmRow?.label}. Existing: ${formatSize(confirmState?.size ?? 0)} (${formatTimestamp(confirmState?.modified ?? '')}). New: ${formatSize(confirmState?.localSize ?? 0)} (${formatTimestamp(confirmState?.localModified ?? '')}).`,
  );
</script>

{#snippet themePreview(tokens: Record<string, string>)}
  {@const c = (k: string) => `rgb(${tokens[k]})`}
  <div
    class="flex h-16 gap-1.5 rounded-lg border p-1.5"
    style="background: {c('--color-background')}; border-color: {c('--color-line-strong')};"
  >
    <div class="flex w-1/3 flex-col gap-1 rounded-md p-1" style="background: {c('--color-card')};">
      <div class="h-1 w-full rounded-sm" style="background: {c('--color-primary')};"></div>
      <div class="h-1 w-3/4 rounded-sm" style="background: {c('--color-muted')};"></div>
      <div class="h-1 w-1/2 rounded-sm" style="background: {c('--color-muted-foreground')};"></div>
    </div>
    <div class="flex flex-1 flex-col gap-1">
      <div class="h-1.5 w-3/4 rounded-sm" style="background: {c('--color-foreground')};"></div>
      <div class="h-1 w-1/2 rounded-sm" style="background: {c('--color-muted')};"></div>
      <div class="mt-auto flex gap-1">
        <div class="h-2.5 w-1/2 rounded-sm" style="background: {c('--color-primary')};"></div>
        <div class="h-2.5 w-1/4 rounded-sm" style="background: {c('--color-success')};"></div>
        <div class="h-2.5 w-1/4 rounded-sm" style="background: {c('--color-warning')};"></div>
      </div>
    </div>
  </div>
{/snippet}

{#snippet sectionTitle(title: string, description: string)}
  <div class="mb-4">
    <h3 class="text-foreground font-semibold text-xs uppercase tracking-wide">{title}</h3>
    <p class="text-muted text-xs mt-1 leading-relaxed">{description}</p>
  </div>
{/snippet}

{#snippet categoryHeader(icon: Component<{ size?: number; class?: string }>, title: string, description: string)}
  <div class="md:col-span-2 flex items-center gap-3 mb-1">
    <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-line/8 bg-card text-foreground">
      {#if icon}
        {@const Icon = icon}
        <Icon size={16} />
      {/if}
    </div>
    <div>
      <h2 class="text-foreground font-semibold text-sm leading-tight">{title}</h2>
      <p class="text-muted text-xs mt-0.5 leading-relaxed">{description}</p>
    </div>
  </div>
{/snippet}

<div class="flex-1 flex flex-col overflow-hidden">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
    <div class="flex items-center gap-3">
      <IconButton icon={ArrowLeft} label="Back to Home" onclick={onBack} />
      <h2 class="text-foreground font-semibold text-base">Settings</h2>
    </div>
    <Button variant="primary" loading={isSaving} onclick={handleSave}>
      {isSaving ? 'Saving…' : 'Save'}
    </Button>
  </div>

  <!-- Body -->
  <div class="flex-1 overflow-y-auto p-6">
    <div class="max-w-3xl mx-auto flex flex-col gap-8">
      <!-- ── Exporter ── -->
      <div>
        {@render categoryHeader(Settings2, 'Exporter', 'How the app itself works — appearance, notifications, publishing credentials and sync safety.')}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card class="p-4 md:col-span-2">
            {@render sectionTitle('Export', 'Where exported .mrpack files land.')}
            <div>
              <label class={LABEL_CLASSES} for="settings-export-dir">
                Export Directory <span class="text-muted font-normal">(optional)</span>
              </label>
              <div class="flex gap-2">
                <div class="flex-1">
                  <Input
                    id="settings-export-dir"
                    bind:value={exportDir}
                    oninput={() => (hasChanges = true)}
                    placeholder="Leave blank for default"
                  />
                </div>
                <IconButton
                  icon={FolderOpen}
                  label="Browse"
                  variant="secondary"
                  sizeClass="px-3 py-2"
                  onclick={selectExportDir}
                />
              </div>
            </div>
          </Card>

          <Card class="p-4 md:col-span-2">
            {@render sectionTitle('Notifications', 'Discord notification after every successful push.')}
            <div class="flex gap-2">
              <div class="flex-1">
                <Input
                  bind:value={discordWebhook}
                  oninput={() => (hasChanges = true)}
                  placeholder="https://discord.com/api/webhooks/…"
                />
              </div>
              <button
                onclick={handleTestWebhook}
                disabled={isTestingWebhook || !discordWebhook.trim()}
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 bg-link/10 text-link border border-link/25 hover:bg-link/20"
                title="Send a test message"
              >
                {#if isTestingWebhook}<Loader2 size={13} class="animate-spin" />{:else}<Send size={13} />{/if}
                {isTestingWebhook ? 'Sending…' : 'Test'}
              </button>
            </div>
          </Card>

          <Card class="p-4">
            {@render sectionTitle('Publishing', 'Credential the app uses to publish releases in Production mode.')}
            <div>
              <label class={LABEL_CLASSES} for="settings-modrinth-token">Modrinth Token</label>
              <Input
                id="settings-modrinth-token"
                type="password"
                bind:value={modrinthToken}
                oninput={() => (hasChanges = true)}
                placeholder="mrpat_…"
                spellcheck={false}
                autocomplete="off"
              />
              <p class="text-muted text-xs mt-2 leading-relaxed">
                Personal Access Token used to publish the modpack to Modrinth.
                Create one in your Modrinth account settings (Authorization).
              </p>
            </div>
          </Card>

          <Card class="p-4">
            {@render sectionTitle('Advanced', 'Safety switches that change how sync behaves.')}
            <div class="flex flex-col gap-4">
              <div>
                <div class="flex items-center gap-3">
                  <Toggle checked={readOnlyEnabled} onChange={handleReadOnlyToggle} label="Read-only mode" />
                  <span class="text-sm font-medium {readOnlyEnabled ? 'text-success' : 'text-muted'}">
                    {readOnlyEnabled ? 'Read-only is ON' : 'Read-only is OFF'}
                  </span>
                </div>
                <p class="text-muted text-[11px] mt-1.5 leading-relaxed">
                  When enabled, pull and push operations are blocked. Useful to inspect the
                  modpack without risking accidental changes.
                </p>
              </div>
              <div>
                <div class="flex items-center gap-3">
                  <Toggle checked={autoSyncEnabled} onChange={handleAutoSyncToggle} label="Auto-sync on launch" />
                  <span class="text-sm font-medium {autoSyncEnabled ? 'text-success' : 'text-muted'}">
                    {autoSyncEnabled ? 'Auto-sync is ON' : 'Auto-sync is OFF'}
                  </span>
                </div>
                <p class="text-muted text-[11px] mt-1.5 leading-relaxed">
                  Automatically pulls the latest modpack after login. Off by default — auto-sync
                  can overwrite local changes you haven't pushed yet.
                </p>
              </div>
            </div>
          </Card>

          <Card class="p-4 md:col-span-2">
            {@render sectionTitle('Appearance', 'Pick an appearance for the whole app. Applied instantly and remembered across launches.')}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {#each THEMES as t (t.id)}
                <button
                  type="button"
                  onclick={() => themeState.set(t.id)}
                  class="flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors {themeState.current ===
                  t.id
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-line/8 hover:bg-line/10'}"
                >
                  {@render themePreview(t.tokens)}
                  <div>
                    <p class="text-xs font-medium text-foreground">{t.name}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                  </div>
                </button>
              {/each}
            </div>
          </Card>
        </div>
      </div>

      <!-- ── Modpack ── -->
      <div class="border-t border-line/8 pt-8">
        {@render categoryHeader(Package, 'Modpack', 'What goes inside the exported package — profile, project metadata and game versions.')}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card class="p-4 md:col-span-2">
            {@render sectionTitle('Modpack Profile', 'The modpack profile that gets exported.')}
            <label class={LABEL_CLASSES} for="settings-modpack-root">
              Modpack Root Directory <span class="text-brand">*</span>
            </label>
            <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
          </Card>

          <Card class="p-4 md:col-span-2">
            {@render sectionTitle('Modrinth Metadata', 'Project identity and game versions written into the manifest and sent to Modrinth.')}
            <div class="flex flex-col gap-4">
              <div>
                <label class={LABEL_CLASSES} for="settings-modrinth-project-id">Modrinth Project ID</label>
                <Input
                  id="settings-modrinth-project-id"
                  bind:value={modrinthProjectId}
                  oninput={() => (hasChanges = true)}
                  placeholder="O5wGsyGR"
                  spellcheck={false}
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class={LABEL_CLASSES} for="settings-minecraft-version">Minecraft version</label>
                  <Input
                    id="settings-minecraft-version"
                    bind:value={minecraftVersion}
                    oninput={() => (hasChanges = true)}
                    placeholder="1.21.1"
                    spellcheck={false}
                  />
                </div>
                <div>
                  <label class={LABEL_CLASSES} for="settings-fabric-loader-version">Fabric Loader version</label>
                  <Input
                    id="settings-fabric-loader-version"
                    bind:value={fabricLoaderVersion}
                    oninput={() => (hasChanges = true)}
                    placeholder="0.16.9"
                    spellcheck={false}
                  />
                </div>
              </div>
            </div>
          </Card>

          {#if hasAnyDefaults}
            <Card class="p-4 md:col-span-2">
              {@render sectionTitle('Default Options', 'Curated options, keybinds and server list embedded into every export. Import them once from a singleplayer world — personal local settings never leak into the modpack.')}
              <div class="flex flex-col gap-2">
                {#each DEFAULT_OPTIONS_ROWS.filter(({ fileType }) => {
                  const s = defaultsState?.[fileType];
                  return !!s && (s.localExists || s.exists);
                }) as { fileType, label } (fileType)}
                  {@const state = defaultsState?.[fileType]}
                  {@const ready = state?.localExists ?? false}
                  {@const imported = state?.exists ?? false}
                  {@const identical = ready && imported && !!state?.localSha256 && state.localSha256 === state.sha256}
                  {@const importing = importingFile === fileType}
                  <div class="flex items-center gap-3 rounded-lg border border-line/8 bg-subtle px-3 py-2.5">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-foreground">{label}</span>
                        <Badge tone={identical ? 'info' : ready ? 'warning' : 'success'}>
                          {identical ? 'Same as published' : ready ? 'Ready to import' : 'Imported'}
                        </Badge>
                      </div>
                      {#if imported && state?.size !== undefined && state?.modified}
                        <p class="text-muted text-[11px] mt-1 leading-relaxed">
                          {ready ? 'Current: ' : ''}{formatSize(state.size)} · {formatTimestamp(state.modified)}
                        </p>
                      {/if}
                    </div>
                    {#if ready}
                      <Button variant="secondary" size="sm" loading={importing} onclick={() => handleDefaultImportClick(fileType)}>
                        Import
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
              <p class="text-muted text-xs mt-3 leading-relaxed">
                Run /defaultoptions saveAll in a singleplayer world to generate these files before importing.
              </p>
            </Card>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if confirmReplace && confirmRow && confirmState}
    <ConfirmDialog
      open
      title={confirmIdentical ? 'Already published' : 'Replace default'}
      description={confirmDescription}
      confirmLabel={confirmIdentical ? 'Discard local copy' : 'Replace'}
      cancelLabel="Cancel"
      variant="warning"
      onConfirm={async () => {
        const ft = confirmReplace!;
        confirmReplace = null;
        await handleDefaultImport(ft);
      }}
      onCancel={() => (confirmReplace = null)}
    />
  {/if}
</div>
