<!--
  Logs page — live console capture with severity filter, search, copy, clear.
-->
<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Info from '@lucide/svelte/icons/info';
  import Search from '@lucide/svelte/icons/search';
  import XCircle from '@lucide/svelte/icons/circle-x';
  import Button from '../base/Button.svelte';
  import Badge, { type BadgeTone } from '../base/Badge.svelte';
  import Input from '../base/Input.svelte';
  import ExpandableText from '../base/ExpandableText.svelte';
  import { getLogs, clearLogs, subscribe, formatLogsForClipboard, type LogEntry } from '../../utils/logger';
  import type { LogLevel } from '../../types';
  import { toast } from '../../state/toast.svelte';

  // Context tags are freeform text inside the message — no structured
  // categorization. Map known tags (exact match first, prefix fallback) to
  // semantic Badge tones so they read consistently with the rest of the app.
  const TAG_TONES: Record<string, BadgeTone> = {
    main: 'info',
    updater: 'info',
    scan: 'warning',
    'git:pull': 'success',
    'git:ensure-versions-repo': 'success',
    git: 'success',
    pull: 'success',
    push: 'warning',
    'undo-push': 'danger',
    discord: 'info',
    changelog: 'info',
    export: 'warning',
    'modrinth-cache': 'warning',
    'pull-state': 'neutral',
  };

  // `all` shows everything; info/warn/error show that severity and above.
  const FILTERS: { value: 'all' | LogLevel; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'info', label: 'Info+' },
    { value: 'warn', label: 'Warnings+' },
    { value: 'error', label: 'Errors' },
  ];

  const SEVERITY: Record<LogLevel, number> = { log: 0, info: 1, warn: 2, error: 3 };

  function parseTag(message: string): { tag: string | null; rest: string } {
    const m = message.match(/^\[([^\]]+)\]\s*(.*)/);
    if (m) return { tag: m[1], rest: m[2] };
    return { tag: null, rest: message };
  }

  function tagTone(tag: string): BadgeTone {
    if (TAG_TONES[tag]) return TAG_TONES[tag];
    for (const [prefix, tone] of Object.entries(TAG_TONES)) {
      if (tag.startsWith(prefix)) return tone;
    }
    return 'neutral';
  }

  function levelClass(level: LogEntry['level']): string {
    switch (level) {
      case 'error':
        return 'bg-danger/10 border-l-2 border-danger/50';
      case 'warn':
        return 'bg-warning/10 border-l-2 border-warning/50';
      default:
        return '';
    }
  }

  function levelTextClass(level: LogEntry['level']): string {
    switch (level) {
      case 'error':
        return 'text-danger';
      case 'warn':
        return 'text-warning';
      default:
        return 'text-foreground';
    }
  }

  let filter = $state<'all' | LogLevel>('all');
  let search = $state('');
  let copied = $state(false);
  let scrollEl: HTMLDivElement | undefined = $state();

  // Live store: renderer console captures + main-process stream, no polling.
  let logs = $state<LogEntry[]>(getLogs());

  $effect(() => {
    const unsub = subscribe(() => {
      logs = [...getLogs()];
    });
    return unsub;
  });

  const query = $derived(search.trim().toLowerCase());
  const visibleLogs = $derived(
    logs.filter(
      e =>
        (filter === 'all' || SEVERITY[e.level] >= SEVERITY[filter]) &&
        (!query || e.message.toLowerCase().includes(query)),
    ),
  );

  // Auto-scroll to bottom when new logs arrive.
  $effect(() => {
    void logs.length;
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatLogsForClipboard(visibleLogs));
      copied = true;
      toast.success('Logs copied to clipboard');
      setTimeout(() => (copied = false), 2000);
    } catch {
      toast.error('Failed to copy logs');
    }
  }

  function handleClear() {
    clearLogs();
    toast.success('Logs cleared');
  }
</script>

{#snippet logIcon(level: LogEntry['level'])}
  {#if level === 'error'}
    <XCircle size={13} class="text-danger flex-shrink-0 mt-0.5" />
  {:else if level === 'warn'}
    <AlertTriangle size={13} class="text-warning flex-shrink-0 mt-0.5" />
  {:else if level === 'info'}
    <Info size={13} class="text-primary flex-shrink-0 mt-0.5" />
  {:else}
    <Info size={13} class="text-muted flex-shrink-0 mt-0.5" />
  {/if}
{/snippet}

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
    <h2 class="text-foreground font-semibold text-base">Logs</h2>
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="sm" icon={Trash2} disabled={logs.length === 0} onclick={handleClear}>
        Clear
      </Button>
      <Button
        variant={copied ? 'soft-success' : 'primary'}
        size="sm"
        icon={copied ? Check : Copy}
        disabled={logs.length === 0}
        onclick={handleCopy}
      >
        {copied ? 'Copied' : 'Copy Logs'}
      </Button>
    </div>
  </div>

  <div class="flex items-center gap-3 px-6 py-2.5 border-b border-line/6 flex-shrink-0">
    <div class="flex items-center gap-0.5">
      {#each FILTERS as f (f.value)}
        <button
          onclick={() => (filter = f.value)}
          class="px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap {filter ===
          f.value
            ? 'bg-line/8 text-foreground'
            : 'text-muted hover:bg-line/4'}"
        >
          {f.label}
        </button>
      {/each}
    </div>
    <div class="flex-1"></div>
    <div class="relative w-64">
      <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        bind:value={search}
        placeholder="Search logs…"
        aria-label="Search logs"
        class="pl-9 h-8 py-1.5 text-xs"
      />
    </div>
  </div>

  <div bind:this={scrollEl} class="flex-1 overflow-y-auto p-4 font-mono">
    {#if logs.length === 0}
      <div class="flex items-center justify-center h-full">
        <p class="text-muted text-sm">No logs yet. App activity will appear here.</p>
      </div>
    {:else if visibleLogs.length === 0}
      <div class="flex items-center justify-center h-full">
        <p class="text-muted text-sm">No logs match this filter.</p>
      </div>
    {:else}
      <div class="flex flex-col gap-0.5">
        {#each visibleLogs as entry (`${entry.source}-${entry.id}`)}
          {@const parsed = parseTag(entry.message)}
          <div class="flex items-start gap-1.5 px-3 py-2 rounded-[8px] text-xs leading-relaxed {levelClass(entry.level)}">
            {@render logIcon(entry.level)}
            <span class="text-muted-foreground w-20 flex-shrink-0 select-none tabular-nums">
              {entry.timestamp}
            </span>
            <span class="{levelTextClass(entry.level)} flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              {#if parsed.tag}<Badge tone={tagTone(parsed.tag)}>{parsed.tag}</Badge>{/if}
              <ExpandableText text={parsed.tag ? parsed.rest : entry.message} lines={3} />
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
