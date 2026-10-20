<!--
  Issues page — GitHub bug tracker with state/label filters and sorting.
-->
<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Inbox from '@lucide/svelte/icons/inbox';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import type { Issue, IssueLabel } from '../../types';
  import Card from '../base/Card.svelte';
  import Button from '../base/Button.svelte';
  import IconButton from '../base/IconButton.svelte';
  import { timeAgo } from '../../utils/format';
  import { ipc } from '../../ipc';

  type StateFilter = 'open' | 'closed' | 'all';
  type SortMode = 'newest' | 'oldest' | 'comments';

  const STATE_FILTERS: { value: StateFilter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
  ];

  const SORT_MODES: { value: SortMode; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'comments', label: 'Most commented' },
  ];

  function parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  let issues = $state<Issue[]>([]);
  let labels = $state<IssueLabel[]>([]);
  let stateFilter = $state<StateFilter>('open');
  let labelFilter = $state<string | null>(null);
  let sortMode = $state<SortMode>('newest');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let expanded = $state<Set<number>>(new Set());

  function toggleExpanded(number: number) {
    const next = new Set(expanded);
    if (next.has(number)) next.delete(number);
    else next.add(number);
    expanded = next;
  }

  async function load() {
    isLoading = true;
    error = null;
    try {
      const cfg = await ipc.config.read();
      if (!cfg.success || !cfg.data?.reports_repo) {
        throw new Error('No reports repository configured. Add reports_repo to config.yaml.');
      }
      const parsed = parseRepoUrl(cfg.data.reports_repo);
      if (!parsed) throw new Error('Invalid reports_repo in config.yaml.');
      const [issuesRes, labelsRes] = await Promise.all([
        ipc.github.getIssues({ ...parsed, state: 'all', per_page: 100 }),
        ipc.github.getLabels(parsed),
      ]);
      if (!issuesRes.success) throw new Error(issuesRes.error || 'Failed to load issues');
      if (!labelsRes.success) throw new Error(labelsRes.error || 'Failed to load labels');
      issues = issuesRes.data ?? [];
      labels = labelsRes.data ?? [];
    } catch (e: any) {
      error = e?.message || 'Failed to load issues';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const visibleIssues = $derived(
    issues
      .filter(i => stateFilter === 'all' || i.state === stateFilter)
      .filter(i => !labelFilter || i.labels.some(l => l.name === labelFilter))
      .sort((a, b) => {
        if (sortMode === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
        if (sortMode === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
        return b.comments - a.comments || +new Date(b.created_at) - +new Date(a.created_at);
      }),
  );
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
    <div class="flex items-center gap-4">
      <h2 class="text-foreground font-semibold text-base">Issues</h2>
      <div class="flex items-center gap-0.5">
        {#each STATE_FILTERS as f (f.value)}
          <button
            onclick={() => (stateFilter = f.value)}
            class="px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap {stateFilter ===
            f.value
              ? 'bg-line/8 text-foreground'
              : 'text-muted hover:bg-line/4'}"
          >
            {f.label}
          </button>
        {/each}
      </div>
      <div class="flex items-center gap-0.5">
        {#each SORT_MODES as s (s.value)}
          <button
            onclick={() => (sortMode = s.value)}
            class="px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap {sortMode ===
            s.value
              ? 'bg-line/8 text-foreground'
              : 'text-muted hover:bg-line/4'}"
          >
            {s.label}
          </button>
        {/each}
      </div>
    </div>
    <Button variant="ghost" size="sm" icon={RefreshCw} disabled={isLoading} onclick={() => void load()}>
      Refresh
    </Button>
  </div>

  {#if labels.length > 0}
    <div class="flex items-center gap-1.5 px-6 py-2.5 border-b border-line/6 flex-shrink-0 overflow-x-auto">
      <button
        onclick={() => (labelFilter = null)}
        class="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors {labelFilter ===
        null
          ? 'bg-line/8 text-foreground'
          : 'text-muted hover:bg-line/4'}"
      >
        All labels
      </button>
      {#each labels as l (l.name)}
        <button
          onclick={() => (labelFilter = labelFilter === l.name ? null : l.name)}
          class="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-opacity"
          style="background: #{l.color}1f; color: #{l.color}; border: 1px solid #{l.color}33; opacity: {labelFilter ===
          null || labelFilter === l.name
            ? 1
            : 0.4};"
        >
          {l.name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto p-4">
    {#if isLoading}
      <div class="flex flex-col gap-2">
        {#each [0, 1, 2, 3] as i (i)}
          <div class="animate-pulse">
            <Card class="p-3.5">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-line/10"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 rounded bg-line/10 w-2/3"></div>
                  <div class="h-2.5 rounded bg-line/10 w-1/3"></div>
                </div>
              </div>
            </Card>
          </div>
        {/each}
      </div>
    {:else if error}
      <div class="flex flex-col items-center justify-center h-full gap-3">
        <TriangleAlert size={28} class="text-warning" />
        <p class="text-foreground text-sm font-medium">Couldn't load issues</p>
        <p class="text-muted text-xs max-w-sm text-center">{error}</p>
        <Button variant="soft" size="sm" icon={RefreshCw} onclick={() => void load()}>Try again</Button>
      </div>
    {:else if visibleIssues.length === 0}
      <div class="flex flex-col items-center justify-center h-full gap-3">
        <Inbox size={28} class="text-muted" />
        <p class="text-foreground text-sm font-medium">
          {issues.length === 0 ? 'No issues yet' : 'No issues match these filters'}
        </p>
        <p class="text-muted text-xs max-w-sm text-center">
          {issues.length === 0
            ? 'The bug tracker is empty. Issues will appear here once they are opened on GitHub.'
            : 'Try a different state, label, or clear the filters.'}
        </p>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each visibleIssues as issue (issue.number)}
          <Card class="p-3.5">
            <div class="flex items-start gap-3">
              <span class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 {issue.state === 'open' ? 'bg-success' : 'bg-muted'}"></span>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0 flex-wrap">
                    <span class="text-foreground text-sm font-medium leading-snug">{issue.title}</span>
                    <span class="text-muted text-xs flex-shrink-0">#{issue.number}</span>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    {#if issue.body?.trim()}
                      <button
                        onclick={() => toggleExpanded(issue.number)}
                        class="flex items-center gap-1 px-1.5 py-1 rounded-[6px] text-xs text-muted hover:text-foreground hover:bg-line/4 transition-colors"
                      >
                        {#if expanded.has(issue.number)}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
                        <span>Description</span>
                      </button>
                    {/if}
                    <IconButton
                      label="Open in GitHub"
                      icon={ExternalLink}
                      iconSize={13}
                      sizeClass="w-6 h-6"
                      onclick={() => ipc.app.openExternal(issue.html_url)}
                    />
                  </div>
                </div>
                {#if issue.body?.trim() && expanded.has(issue.number)}
                  <div class="mt-2.5 pt-2.5 border-t border-line/6 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                    {issue.body}
                  </div>
                {/if}
                {#if issue.labels.length > 0}
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {#each issue.labels as l (l.name)}
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style="background: #{l.color}1f; color: #{l.color}; border: 1px solid #{l.color}33;"
                      >
                        {l.name}
                      </span>
                    {/each}
                  </div>
                {/if}
                <div class="flex items-center gap-2 mt-2 text-muted text-xs">
                  <img src={issue.user.avatar_url} alt={issue.user.login} class="w-4 h-4 rounded-full flex-shrink-0" />
                  <span class="truncate">{issue.user.login}</span>
                  <span class="flex-shrink-0">{timeAgo(issue.created_at)}</span>
                  {#if issue.comments > 0}
                    <span class="flex items-center gap-1 flex-shrink-0">
                      <MessageSquare size={11} />
                      {issue.comments}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</div>
