<!-- Right-hand sidebar — modpack info, team sync actions, export, bugs. -->
<script lang="ts">
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import Bug from '@lucide/svelte/icons/bug';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Clock from '@lucide/svelte/icons/clock';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Package from '@lucide/svelte/icons/package';
  import type { AppConfig, Issue, SyncStatus, ProfileMode } from '../../types';
  import Button from '../base/Button.svelte';
  import Card from '../base/Card.svelte';
  import ModeToggle from '../base/ModeToggle.svelte';
  import { timeAgo } from '../../utils/format';
  import { ipc } from '../../ipc';

  interface Props {
    config: AppConfig | null;
    syncStatus: SyncStatus;
    issues: Issue[];
    lastExportTime: string | null;
    manifestVersion: number | null;
    modrinthRelease: string | null;
    onPull: () => void;
    onPush: () => void;
    onUndoLastPush: () => void;
    isUndoingLastPush: boolean;
    onExport: () => void;
    onReportBug: () => void;
    profileMode: ProfileMode;
    onModeChange: (mode: ProfileMode) => void;
  }

  let {
    config,
    syncStatus,
    issues,
    lastExportTime,
    manifestVersion,
    modrinthRelease,
    onPull,
    onPush,
    onUndoLastPush,
    isUndoingLastPush,
    onExport,
    onReportBug,
    profileMode,
    onModeChange,
  }: Props = $props();
</script>

{#snippet row(label: string, value: string, valueColor?: string)}
  <div class="flex items-center justify-between gap-2">
    <span class="text-muted text-xs flex-shrink-0">{label}</span>
    <span
      class="text-xs font-medium truncate text-right min-w-0"
      style="color: {valueColor || 'rgb(var(--color-foreground))'};"
    >
      {value}
    </span>
  </div>
{/snippet}

<div
  class="flex-shrink-0 flex flex-col gap-3 overflow-y-auto p-4 border-l border-line/6"
  style="width: 296px;"
>
  <!-- Modpack Info -->
  <Card class="p-3">
    <h3 class="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Modpack Info</h3>
    <div class="flex flex-col gap-2">
      {#if config}
        {@render row('Pack', config.pack_name)}
        {@render row('Dev version', manifestVersion !== null ? String(manifestVersion) : 'N/A')}
        {@render row('Modrinth release', modrinthRelease ? `v${modrinthRelease}` : 'N/A')}
        {@render row('Minecraft', config.minecraft_version)}
        <div>
          <span class="text-muted text-xs block mb-1.5">Mode</span>
          <ModeToggle mode={profileMode} onChange={onModeChange} />
        </div>
        <div class="h-px bg-line/6 my-0.5"></div>
        {@render row('Last export', lastExportTime ? timeAgo(lastExportTime) : 'Never')}
      {:else}
        <p class="text-muted text-xs">No config loaded</p>
      {/if}
    </div>
  </Card>

  <!-- Team Sync -->
  <Card class="p-3">
    <h3 class="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Team Sync</h3>
    <div class="flex flex-col gap-1.5 mb-3">
      {#if syncStatus.branch}
        <div class="flex items-center gap-1.5 min-w-0">
          <GitBranch size={12} class="text-muted flex-shrink-0" />
          <span class="text-foreground text-xs font-mono truncate">{syncStatus.branch}</span>
          {#if syncStatus.ahead > 0}
            <span class="flex items-center gap-0.5 text-warning text-xs">
              <ArrowUp size={10} />{syncStatus.ahead}
            </span>
          {/if}
          {#if syncStatus.behind > 0}
            <span class="flex items-center gap-0.5 text-primary text-xs">
              <ArrowDown size={10} />{syncStatus.behind}
            </span>
          {/if}
        </div>
      {/if}
      {#if syncStatus.lastPull}
        <div class="flex items-center gap-1.5">
          <Clock size={12} class="text-muted" />
          <span class="text-muted text-xs">Pulled {timeAgo(syncStatus.lastPull)}</span>
        </div>
      {/if}
      {#if syncStatus.modified.length > 0}
        <p class="text-warning text-xs">
          {syncStatus.modified.length} uncommitted change{syncStatus.modified.length !== 1 ? 's' : ''}
        </p>
      {/if}
    </div>
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <Button variant="success" size="sm" icon={Download} class="flex-1" onclick={onPull}>
          Pull latest
        </Button>
        <Button variant="primary" size="sm" icon={Upload} class="flex-1" onclick={onPush}>
          Push changes
        </Button>
      </div>
      <Button
        variant="soft-danger"
        size="sm"
        icon={RotateCcw}
        fullWidth
        loading={isUndoingLastPush}
        onclick={onUndoLastPush}
      >
        {isUndoingLastPush ? 'Undoing…' : 'Undo last push'}
      </Button>
    </div>
  </Card>

  <!-- Export -->
  <Button variant="primary" icon={Package} fullWidth onclick={onExport} class="py-2.5 rounded-[10px]">
    Export New Version
  </Button>

  <!-- Bugs -->
  <Card class="p-3">
    <h3 class="text-foreground font-semibold text-xs uppercase tracking-wide mb-2">Bugs</h3>
    {#if issues.length === 0}
      <p class="text-muted text-xs">No open issues</p>
    {:else}
      <div class="flex flex-col gap-1">
        {#each issues as issue (issue.number)}
          <button
            onclick={() => ipc.app.openExternal(issue.html_url)}
            class="w-full text-left p-2 -mx-2 rounded-lg hover:bg-line/6 transition-colors group"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-foreground text-xs leading-snug line-clamp-2 flex-1">{issue.title}</p>
              <ExternalLink
                size={11}
                class="text-muted opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0"
              />
            </div>
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              <span class="text-muted text-xs">#{issue.number}</span>
              {#each issue.labels?.slice(0, 3) ?? [] as l (l.name)}
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style="background: #{l.color}1f; color: #{l.color}; border: 1px solid #{l.color}33;"
                >
                  {l.name}
                </span>
              {/each}
            </div>
          </button>
        {/each}
      </div>
    {/if}
    <button
      onclick={onReportBug}
      class="flex items-center gap-1.5 text-xs mt-2.5 transition-opacity whitespace-nowrap text-warning hover:opacity-80"
    >
      <Bug size={12} />
      Report a Bug
    </button>
  </Card>
</div>
