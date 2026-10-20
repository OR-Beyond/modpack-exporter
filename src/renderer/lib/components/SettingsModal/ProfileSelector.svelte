<!--
  Launcher profile picker — scans every major launcher, groups by launcher,
  supports search + manual browse.
-->
<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Check from '@lucide/svelte/icons/check';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import AlertCircle from '@lucide/svelte/icons/circle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Blocks from '@lucide/svelte/icons/blocks';
  import Boxes from '@lucide/svelte/icons/boxes';
  import Package from '@lucide/svelte/icons/package';
  import Layers from '@lucide/svelte/icons/layers';
  import Flame from '@lucide/svelte/icons/flame';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import type { Component } from 'svelte';
  import type { LauncherProfileGroup } from '../../types';
  import { pluralize } from '../../utils/format';
  import Button from '../base/Button.svelte';
  import Input from '../base/Input.svelte';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';

  interface Props {
    /** Currently selected modpack root path (empty string if none). */
    selectedPath: string;
    /** Called after a profile (or manually-browsed folder) has been selected and
     *  persisted as the modpack root. */
    onSelected: (path: string, profileName?: string) => void;
  }

  // Launcher brand colors — identity colors, kept literal across themes.
  const LAUNCHER_ICONS: Record<string, { Icon: Component<{ size?: number; style?: string; class?: string }>; color: string }> = {
    modrinth: { Icon: Blocks, color: '#00AF5C' },
    prism: { Icon: Boxes, color: '#9C6ADE' },
    multimc: { Icon: Package, color: '#4A90D9' },
    atlauncher: { Icon: Layers, color: '#E1B12C' },
    curseforge: { Icon: Flame, color: '#F16436' },
    gdlauncher: { Icon: Sparkles, color: '#00C2CB' },
  };

  function launcherIconFor(key: string) {
    return LAUNCHER_ICONS[key] ?? { Icon: Package, color: 'rgb(var(--color-muted-foreground))' };
  }

  let { selectedPath, onSelected }: Props = $props();

  let groups = $state<LauncherProfileGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state('');
  let expanded = $state<Record<string, boolean>>({});

  async function scan(currentSelectedPath: string) {
    loading = true;
    error = null;
    try {
      const result = await ipc.modpack.listProfiles();
      if (!result.success) {
        groups = [];
        error = result.error || 'Scan failed';
        return;
      }
      groups = result.data;
      // Default expand: groups containing the currently selected profile open,
      // everything else collapsed. Only computed on a fresh scan — the user is
      // free to toggle groups afterward without them snapping back.
      const nextExpanded: Record<string, boolean> = {};
      for (const group of result.data) {
        nextExpanded[group.launcher] = group.profiles.some(p => p.path === currentSelectedPath);
      }
      expanded = nextExpanded;
    } catch (e: any) {
      groups = [];
      error = e?.message ?? 'Scan failed';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Only run once on mount — refreshes afterward are user-triggered so the
    // expand state doesn't get silently recomputed out from under the user.
    void scan(selectedPath);
  });

  function handleRefresh() {
    void scan(selectedPath);
  }

  async function handleSelectPath(path: string, name?: string) {
    try {
      await ipc.modpack.setRootFromProfile(path);
      onSelected(path, name);
    } catch (e: any) {
      toast.error(`Could not select profile: ${e?.message ?? 'unknown error'}`);
    }
  }

  async function handleBrowse() {
    const dir = await ipc.app.selectDirectory();
    if (!dir) return;
    await handleSelectPath(dir);
  }

  function toggleGroup(key: string) {
    expanded = { ...expanded, [key]: !(expanded[key] ?? false) };
  }

  // ── Search filtering ───────────────────────────────────────────────────────
  const query = $derived(search.trim().toLowerCase());
  const filteredGroups = $derived.by(() => {
    if (!query) return groups;
    return groups
      .map(g => ({ ...g, profiles: g.profiles.filter(p => p.name.toLowerCase().includes(query)) }))
      .filter(g => g.profiles.length > 0);
  });

  function isExpanded(key: string): boolean {
    return query ? true : (expanded[key] ?? false);
  }
</script>

<div class="flex flex-col gap-2.5">
  <!-- Search + refresh -->
  <div class="flex gap-2">
    <div class="relative flex-1">
      <Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input bind:value={search} placeholder="Search profiles…" class="pl-8" />
    </div>
    <Button
      variant="secondary"
      size="sm"
      icon={RefreshCw}
      loading={loading}
      onclick={handleRefresh}
      title="Rescan all launchers"
    >
      Refresh
    </Button>
  </div>

  <!-- List surface -->
  <div class="rounded-lg overflow-hidden bg-card border border-line-strong">
    <div class="max-h-[280px] overflow-y-auto">
      {#if loading}
        <div class="flex items-center gap-2 px-3 py-4 text-xs justify-center text-muted-foreground">
          <Loader2 size={13} class="animate-spin" />
          Scanning launchers…
        </div>
      {:else if error}
        <div class="flex items-center gap-2 px-3 py-4 text-xs justify-center text-danger">
          <AlertCircle size={13} />
          {error}
        </div>
      {:else if filteredGroups.length === 0}
        <div class="px-3 py-4 text-xs text-center text-muted-foreground">
          {query
            ? `No profiles match "${search}"`
            : 'No modded profiles found on this machine. Use Browse manually below.'}
        </div>
      {:else}
        {#each filteredGroups as group (group.launcher)}
          {@const { Icon, color } = launcherIconFor(group.launcherIcon)}
          {@const open = isExpanded(group.launcher)}
          <div class="border-b border-line-strong last:border-b-0">
            <button
              onclick={() => toggleGroup(group.launcher)}
              class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-line/10"
            >
              {#if open}
                <ChevronDown size={13} class="text-muted-foreground" />
              {:else}
                <ChevronRight size={13} class="text-muted-foreground" />
              {/if}
              <Icon size={14} style="color: {color};" class="flex-shrink-0" />
              <span class="text-sm font-medium flex-1 truncate text-foreground">{group.launcher}</span>
              <span class="text-xs flex-shrink-0 text-muted-foreground">
                {pluralize(group.profiles.length, 'profile', 'profiles')}
              </span>
            </button>

            {#if open}
              <div class="pb-1">
                {#each group.profiles as profile (profile.path)}
                  {@const isSelected = profile.path === selectedPath}
                  <button
                    onclick={() => handleSelectPath(profile.path, profile.name)}
                    title={profile.path}
                    class="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors {isSelected
                      ? 'bg-link/10'
                      : 'hover:bg-line/10'}"
                  >
                    {#if isSelected}
                      <Check size={12} class="text-link flex-shrink-0" />
                    {:else}
                      <span class="w-3 flex-shrink-0"></span>
                    {/if}
                    <span class="text-sm truncate flex-1 {isSelected ? 'text-link' : 'text-foreground'}">
                      {profile.name}
                    </span>
                    <span class="text-xs flex-shrink-0 text-muted-foreground">
                      {pluralize(profile.modCount, 'mod', 'mods')}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Browse manually — always available, pinned below the scanned groups -->
    <button
      onclick={handleBrowse}
      class="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-line/10 border-t border-line-strong"
    >
      <FolderOpen size={14} class="text-link flex-shrink-0" />
      <span class="text-sm font-medium text-link">Browse manually…</span>
    </button>
  </div>

  <!-- Currently selected path -->
  {#if selectedPath}
    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check size={11} class="text-success flex-shrink-0" />
      <span class="truncate font-mono" title={selectedPath}>{selectedPath}</span>
    </div>
  {/if}
</div>
