<!--
  Single commit card — collapsed summary + expandable change details.
  Details are fetched lazily on first hover/click and cached per card.
-->
<script lang="ts">
  import Box from '@lucide/svelte/icons/box';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Code from '@lucide/svelte/icons/code';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import File from '@lucide/svelte/icons/file';
  import Image from '@lucide/svelte/icons/image';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Settings from '@lucide/svelte/icons/settings';
  import type { Component } from 'svelte';
  import type { CommitCard, CommitChanges, CommitFileEntry, CommitModEntry } from '../../types';
  import ModIconLazy from '../common/ModIconLazy.svelte';
  import ModStatusBadge from '../common/ModStatusBadge.svelte';
  import { timeAgo } from '../../utils/format';
  import { prefetchModIcons } from '../../utils/modIcons';
  import { ipc } from '../../ipc';

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\//);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  function statusRingClass(status: CommitModEntry['status']): string {
    if (status === 'added') return 'border-success/40';
    if (status === 'removed') return 'border-danger/40';
    return 'border-warning-soft/40';
  }

  function statusDotColor(status: string): string {
    return status === 'added' ? 'bg-success' : status === 'removed' ? 'bg-danger' : 'bg-warning-soft';
  }

  function fileTypeIcon(filepath: string): Component<{ size?: number; class?: string }> {
    if (filepath.startsWith('overrides/config/') || filepath === 'config.yaml') return Settings;
    if (filepath.startsWith('overrides/resourcepacks/')) return Image;
    if (filepath.startsWith('overrides/shaderpacks/')) return Box;
    if (filepath.startsWith('overrides/scripts/')) return Code;
    return File;
  }

  // ── Main component ──────────────────────────────────────────────────────────

  const MAX_SUMMARY_ICONS = 5;

  interface Props {
    commit: CommitCard;
    /** Absolute date/time instead of relative time (history page). */
    fullDate?: boolean;
  }

  let { commit, fullDate = false }: Props = $props();

  let isExpanded = $state(false);
  let expandedMods = $state<Set<string>>(new Set());
  let localChanges = $state<CommitChanges | null>(null);
  let fetchLoading = $state(false);
  let fetchAttempted = false;

  const changes = $derived(commit.changes ?? localChanges);
  const isLoaded = $derived(commit.detailsLoaded || localChanges !== null);

  async function triggerLoad() {
    if (fetchAttempted || commit.detailsLoaded || fetchLoading) return;
    const parsed = parseOwnerRepo(commit.url);
    if (!parsed) return;
    fetchLoading = true;
    try {
      const [changesRes, filesRes] = await Promise.all([
        ipc.git.commitChanges(commit.sha),
        ipc.github.getCommitFiles({ ...parsed, sha: commit.sha }),
      ]);

      let next: CommitChanges | null = null;
      if (
        changesRes.success &&
        changesRes.data &&
        (changesRes.data.mods.length > 0 || changesRes.data.otherFiles.length > 0)
      ) {
        next = changesRes.data;
      } else if (filesRes.success && filesRes.data) {
        next = {
          mods: filesRes.data.modChanges.map(mc => ({
            slug: mc.slug,
            name: mc.name,
            iconUrl: null,
            versionNumber: null,
            status: mc.type,
          })),
          otherFiles: filesRes.data.files.map(f => ({
            path: f.path,
            status: f.status as 'added' | 'modified' | 'removed',
          })),
        };
      } else {
        next = { mods: [], otherFiles: [] };
      }

      localChanges = next;
      fetchAttempted = true;

      if (next.mods.length > 0) {
        prefetchModIcons(next.mods.map(m => m.slug));
      }
    } catch (err) {
      // Transient failure — keep whatever was loaded and allow a retry on the
      // next hover/click instead of showing an empty list forever.
      console.warn(`[activity] failed to load changes for ${commit.sha}:`, err);
    }
    fetchLoading = false;
  }

  function handleCardClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-noclick]')) return;
    isExpanded = !isExpanded;
    void triggerLoad();
  }

  function toggleMod(slug: string, e: MouseEvent) {
    e.stopPropagation();
    const next = new Set(expandedMods);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    expandedMods = next;
  }

  // Build config groups
  const configsByMod = $derived.by(() => {
    const map = new Map<string, CommitFileEntry[]>();
    if (changes) {
      for (const file of changes.otherFiles) {
        if (file.parentModSlug) {
          if (!map.has(file.parentModSlug)) map.set(file.parentModSlug, []);
          map.get(file.parentModSlug)!.push(file);
        }
      }
    }
    return map;
  });

  // Explicit mods + phantom entries for config-only slugs
  const displayMods = $derived.by<(CommitModEntry & { phantom?: boolean })[]>(() => {
    if (!changes) return [];
    return [
      ...changes.mods,
      ...[...configsByMod.keys()]
        .filter(slug => !changes.mods.some(m => m.slug === slug))
        .map(slug => ({
          slug,
          name: configsByMod.get(slug)![0]?.parentModName ?? slug,
          iconUrl: null,
          versionNumber: null,
          status: 'updated' as const,
          phantom: true,
        })),
    ];
  });

  const ungroupedFiles = $derived(changes?.otherFiles.filter(f => !f.parentModSlug) ?? []);

  // Collapsed summary
  const summaryMods = $derived(changes?.mods ?? []);
  const summaryFileCount = $derived(changes?.otherFiles.length ?? 0);
  const shownIcons = $derived(summaryMods.slice(0, MAX_SUMMARY_ICONS));
  const overflowCount = $derived(
    summaryMods.length > MAX_SUMMARY_ICONS ? summaryMods.length - MAX_SUMMARY_ICONS : 0,
  );
  const summaryText = $derived(
    summaryMods.length > 0
      ? `${summaryMods.length} mod${summaryMods.length !== 1 ? 's' : ''} changed${summaryFileCount > 0 ? ` · ${summaryFileCount} other file${summaryFileCount !== 1 ? 's' : ''}` : ''}`
      : summaryFileCount > 0
        ? `${summaryFileCount} file${summaryFileCount !== 1 ? 's' : ''} changed`
        : null,
  );
</script>

<div
  class="rounded-[12px] cursor-pointer group bg-card border border-line/6 hover:bg-line/5 transition-colors"
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      isExpanded = !isExpanded;
      void triggerLoad();
    }
  }}
  onmouseenter={triggerLoad}
>
  <!-- Always-visible header -->
  <div class="p-4">
    <div class="flex items-start gap-3">
      <img
        src={commit.author.avatar_url}
        alt={commit.author.login}
        class="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
        onerror={(e) => {
          (e.currentTarget as HTMLImageElement).src = 'https://github.com/ghost.png';
        }}
      />

      <div class="flex-1 min-w-0">
        <!-- Author + timestamp -->
        <div class="flex items-center gap-2 mb-1">
          <span class="text-foreground text-sm font-medium">{commit.author.login}</span>
          <span class="text-xs text-muted-foreground">
            {fullDate ? new Date(commit.date).toLocaleString() : timeAgo(commit.date)}
          </span>
        </div>

        <!-- Commit message -->
        <p
          class="text-sm truncate text-foreground"
          style="margin-bottom: {isLoaded || fetchLoading ? 8 : 0}px;"
        >
          {commit.message}
        </p>

        <!-- Collapsed summary row -->
        {#if !isExpanded && isLoaded}
          <div class="flex items-center gap-2 flex-wrap">
            {#if shownIcons.length > 0}
              <div class="flex items-center gap-1">
                {#each shownIcons as mod (mod.slug)}
                  <ModIconLazy
                    slug={mod.slug}
                    name={mod.name}
                    size="sm"
                    class="border-2 {statusRingClass(mod.status)}"
                  />
                {/each}
                {#if overflowCount > 0}
                  <div
                    class="flex items-center justify-center flex-shrink-0 font-medium rounded-full bg-line/10 text-muted-foreground w-6 h-6 text-[9px]"
                  >
                    +{overflowCount}
                  </div>
                {/if}
              </div>
            {/if}
            {#if summaryText}
              <span class="text-xs text-muted-foreground">{summaryText}</span>
            {/if}
          </div>
        {/if}

        <!-- Loading indicator (collapsed) -->
        {#if !isExpanded && !isLoaded && fetchLoading}
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 size={11} class="animate-spin" />
            <span class="text-xs">Loading…</span>
          </div>
        {/if}
      </div>

      <!-- External link + expand chevron -->
      <div class="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <button
          data-noclick="true"
          class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
          title="Open on GitHub"
          onclick={(e) => {
            e.stopPropagation();
            ipc.app.openExternal(commit.url);
          }}
        >
          <ExternalLink size={13} class="text-muted" />
        </button>
        <div
          style="transition: transform 300ms ease; transform: rotate({isExpanded ? 90 : 0}deg);"
        >
          <ChevronRight size={14} class="text-muted" />
        </div>
      </div>
    </div>
  </div>

  <!-- Expandable detail panel — grid-template-rows animation for smooth height -->
  <div
    style="display: grid; grid-template-rows: {isExpanded ? '1fr' : '0fr'}; transition: grid-template-rows 300ms ease;"
  >
    <div style="overflow: hidden;">
      <div class="px-4 pb-4">
        <div class="mb-3 border-t border-line/6"></div>

        <!-- Loading spinner (expanded, not yet loaded) -->
        {#if !isLoaded && fetchLoading}
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 size={11} class="animate-spin" />
            <span class="text-xs">Loading changes…</span>
          </div>
        {/if}

        <!-- Placeholder before first load attempt -->
        {#if !isLoaded && !fetchLoading}
          <p class="text-xs text-muted-foreground">Loading…</p>
        {/if}

        <!-- Full details -->
        {#if isLoaded}
          <div>
            <!-- Mods section -->
            {#if displayMods.length > 0}
              <div class="flex flex-col gap-1">
                {#each displayMods as mod (mod.slug)}
                  {@const configs = configsByMod.get(mod.slug) ?? []}
                  {@const isModExpanded = expandedMods.has(mod.slug)}
                  {@const hasConfigs = configs.length > 0}
                  <div>
                    <!-- Mod row -->
                    <div
                      data-noclick="true"
                      role="button"
                      tabindex="0"
                      class="flex items-center gap-2 py-1 px-0.5 rounded-[6px] -mx-0.5"
                      style="cursor: {hasConfigs ? 'pointer' : 'default'};"
                      onclick={(e) => hasConfigs && toggleMod(mod.slug, e)}
                      onkeydown={(e) => {
                        if (hasConfigs && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          toggleMod(mod.slug, e as unknown as MouseEvent);
                        }
                      }}
                    >
                      <ModIconLazy slug={mod.slug} name={mod.name} size="md" />
                      <span class="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                        {mod.name}
                      </span>
                      {#if !mod.phantom}
                        <ModStatusBadge
                          status={mod.status}
                          versionNumber={mod.versionNumber}
                          oldVersionNumber={mod.oldVersionNumber}
                        />
                      {/if}
                      {#if hasConfigs}
                        {#if isModExpanded}
                          <ChevronDown size={12} class="text-muted flex-shrink-0" />
                        {:else}
                          <ChevronRight size={12} class="text-muted flex-shrink-0" />
                        {/if}
                      {/if}
                    </div>

                    <!-- Config count (collapsed) -->
                    {#if hasConfigs && !isModExpanded}
                      <div
                        data-noclick="true"
                        role="button"
                        tabindex="0"
                        class="flex items-center gap-1 mt-0.5"
                        style="padding-left: 36px; cursor: pointer;"
                        onclick={(e) => toggleMod(mod.slug, e)}
                        onkeydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleMod(mod.slug, e as unknown as MouseEvent);
                          }
                        }}
                      >
                        <span class="text-xs text-muted-foreground">
                          {configs.length} config file{configs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    {/if}

                    <!-- Config files (expanded) -->
                    {#if hasConfigs && isModExpanded}
                      <div
                        data-noclick="true"
                        class="flex flex-col gap-0.5 mt-1 mb-0.5"
                        style="padding-left: 20px;"
                      >
                        {#each configs as file (file.path)}
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span class="w-2 h-2 rounded-full flex-shrink-0 {statusDotColor(file.status)}"></span>
                            <span class="text-xs font-mono truncate flex-1 text-muted-foreground">
                              {file.path}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Divider -->
            {#if displayMods.length > 0 && ungroupedFiles.length > 0}
              <div class="my-2 border-t border-line-strong"></div>
            {/if}

            <!-- Other files -->
            {#if ungroupedFiles.length > 0}
              <div class="flex flex-col gap-1">
                {#each ungroupedFiles as file (file.path)}
                  {@const Icon = fileTypeIcon(file.path)}
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2 h-2 rounded-full flex-shrink-0 {statusDotColor(file.status)}"></span>
                    <Icon size={12} class="text-muted-foreground flex-shrink-0" />
                    <span class="text-xs font-mono truncate flex-1 text-muted-foreground">
                      {file.path}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Nothing to show -->
            {#if displayMods.length === 0 && ungroupedFiles.length === 0}
              <p class="text-xs text-muted-foreground">No file changes recorded</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
