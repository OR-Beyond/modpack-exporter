<!--
  Dedicated change-history page — every commit with full date/time, author,
  and the changed mods/files (via ActivityCard). Shares the commit data loaded
  by App, so refreshing here refreshes the Home preview too.
-->
<script lang="ts">
  import ActivityFeed from '../ActivityFeed/index.svelte';
  import Badge from '../base/Badge.svelte';
  import type { CommitCard } from '../../types';

  interface Props {
    commits: CommitCard[];
    isLoading: boolean;
    onRefresh?: () => void;
  }

  let { commits, isLoading, onRefresh }: Props = $props();
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
    <h2 class="text-foreground font-semibold text-base">Change History</h2>
    <Badge tone="neutral">
      {commits.length} commit{commits.length !== 1 ? 's' : ''}
    </Badge>
  </div>
  <ActivityFeed
    {commits}
    {isLoading}
    hasToken={true}
    {onRefresh}
    showHeader={false}
    fullDate
  />
</div>
