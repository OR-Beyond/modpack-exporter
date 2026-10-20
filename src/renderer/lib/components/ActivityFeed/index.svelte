<!--
  Commit activity feed — header actions, empty/loading states, and the list.
  Used by the home page (limited) and the history page (full).
-->
<script lang="ts">
  import GitCommit from '@lucide/svelte/icons/git-commit';
  import History from '@lucide/svelte/icons/history';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ActivityCard from './ActivityCard.svelte';
  import Button from '../base/Button.svelte';
  import Card from '../base/Card.svelte';
  import type { CommitCard } from '../../types';

  interface Props {
    commits: CommitCard[];
    isLoading: boolean;
    hasToken: boolean;
    onRefresh?: () => void;
    /** Cap the rendered list to the N most recent commits. */
    limit?: number;
    /** Renders a "View all" action in the header when provided. */
    onViewAll?: () => void;
    /** Hides the internal header — used when the page provides its own. */
    showHeader?: boolean;
    /** Shows absolute date/time instead of relative time (history page). */
    fullDate?: boolean;
  }

  let {
    commits,
    isLoading,
    hasToken,
    onRefresh,
    limit,
    onViewAll,
    showHeader = true,
    fullDate = false,
  }: Props = $props();

  const visibleCommits = $derived(limit ? commits.slice(0, limit) : commits);
</script>

{#snippet skeletonCard()}
  <Card class="p-4 animate-pulse">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full flex-shrink-0 bg-line/6"></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-2">
          <div class="h-3 w-24 rounded bg-line/6"></div>
          <div class="h-3 w-12 rounded bg-line/4"></div>
        </div>
        <div class="h-3 w-3/4 rounded mb-2 bg-line/6"></div>
        <div class="flex gap-1.5">
          <div class="h-4 w-16 rounded-full bg-line/5"></div>
          <div class="h-4 w-20 rounded-full bg-line/5"></div>
        </div>
      </div>
    </div>
  </Card>
{/snippet}

<div class="flex-1 overflow-y-auto p-5">
  <!-- Header row: title + view all + refresh -->
  {#if showHeader}
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-foreground font-semibold text-base">Activity</h2>
      <div class="flex items-center gap-2">
        {#if onViewAll}
          <Button variant="ghost" size="sm" icon={History} onclick={onViewAll}>View all</Button>
        {/if}
        {#if hasToken && onRefresh}
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={isLoading}
            onclick={onRefresh}
            aria-label="Refresh activity"
            title="Refresh"
          >
            Refresh
          </Button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- No token -->
  {#if !hasToken}
    <div class="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div class="w-12 h-12 rounded-full bg-card flex items-center justify-center">
        <KeyRound size={22} class="text-muted" />
      </div>
      <p class="text-muted text-sm">Connect GitHub to see activity</p>
      <p class="text-muted-foreground text-xs max-w-[260px]">
        Sign in with GitHub in Settings to view commits, issues, and team changes.
      </p>
    </div>
  {/if}

  <!-- Loading skeleton -->
  {#if hasToken && isLoading && commits.length === 0}
    <div class="flex flex-col gap-3">
      {@render skeletonCard()}
      {@render skeletonCard()}
      {@render skeletonCard()}
      {@render skeletonCard()}
      {@render skeletonCard()}
    </div>
  {/if}

  <!-- Empty state -->
  {#if hasToken && !isLoading && commits.length === 0}
    <div class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-12 h-12 rounded-full bg-card flex items-center justify-center">
        <GitCommit size={22} class="text-muted" />
      </div>
      <p class="text-muted text-sm">No commits found</p>
    </div>
  {/if}

  <!-- Commit list -->
  {#if visibleCommits.length > 0}
    <div class="flex flex-col gap-3">
      {#each visibleCommits as c (c.sha)}
        <ActivityCard commit={c} {fullDate} />
      {/each}
    </div>
  {/if}
</div>
