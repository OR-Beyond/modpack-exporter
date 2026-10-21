<script lang="ts">
  let open = $state(false);
  let violations = $state<{ kind: string; detail: string; at: string }[]>([]);

  async function refresh() {
    violations = await window.electron.sandbox!.getViolations();
  }

  async function reset() {
    await window.electron.sandbox!.reset();
    await refresh();
  }

  $effect(() => {
    if (open) void refresh();
  });
</script>

{#if __SANDBOX__}
  <div class="fixed bottom-4 right-4 z-[9998]">
    {#if open}
      <div class="w-80 rounded-lg border border-line bg-card p-3 shadow-lg text-xs">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-foreground">Sandbox panel</span>
          <button class="text-muted hover:text-foreground" onclick={() => (open = false)}>✕</button>
        </div>
        <div class="text-muted mb-2">Root: {''}</div>
        <div class="flex gap-2 mb-2">
          <button class="px-2 py-1 rounded bg-primary text-on-accent" onclick={reset}>Reset violations</button>
          <button class="px-2 py-1 rounded bg-muted text-foreground" onclick={refresh}>Refresh</button>
        </div>
        <div class="max-h-48 overflow-auto">
          {#if violations.length === 0}
            <div class="text-muted">No guard violations.</div>
          {:else}
            {#each violations as v (v.at)}
              <div class="mb-1 text-danger">{v.kind}: {v.detail}</div>
            {/each}
          {/if}
        </div>
      </div>
    {:else}
      <button
        class="px-3 py-1.5 rounded-full bg-danger text-on-accent text-xs font-bold shadow-lg"
        onclick={() => (open = true)}
      >
        SANDBOX
      </button>
    {/if}
  </div>
{/if}
