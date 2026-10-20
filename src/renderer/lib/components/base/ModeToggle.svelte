<!-- Segmented dev/prod mode switch. -->
<script lang="ts">
  import type { ProfileMode } from '../../types';

  interface Props {
    mode: ProfileMode;
    onChange: (mode: ProfileMode) => void;
    disabled?: boolean;
  }

  let { mode, onChange, disabled = false }: Props = $props();

  const isProd = $derived(mode === 'prod');

  const thumbStyle = $derived(
    isProd
      ? 'left: calc(50% + 2px); background-color: rgb(var(--color-primary) / 0.12); border-color: rgb(var(--color-primary) / 0.4);'
      : 'left: 2px; background-color: rgb(var(--color-warning) / 0.12); border-color: rgb(var(--color-warning) / 0.4);',
  );

  function labelClass(active: boolean, colorVar: string): string {
    return `relative z-10 flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active ? colorVar : 'text-muted-foreground hover:text-foreground'
    }`;
  }
</script>

<div
  role="radiogroup"
  aria-label="App mode"
  class="relative flex p-0.5 rounded-lg border border-line/8 bg-subtle select-none {disabled
    ? 'opacity-50 pointer-events-none'
    : ''}"
>
  <span
    aria-hidden="true"
    class="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md border transition-all duration-200 ease-out"
    style={thumbStyle}
  ></span>
  <button
    type="button"
    role="radio"
    aria-checked={!isProd}
    onclick={() => onChange('dev')}
    class={labelClass(!isProd, 'text-warning')}
  >
    Development
  </button>
  <button
    type="button"
    role="radio"
    aria-checked={isProd}
    onclick={() => onChange('prod')}
    class={labelClass(isProd, 'text-primary')}
  >
    Production
  </button>
</div>
