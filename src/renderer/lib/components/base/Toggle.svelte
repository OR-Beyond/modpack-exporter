<!-- Pill switch — read-only mode / auto-sync toggles. -->
<script lang="ts">
  interface Props {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    /** Accessible name for the switch. */
    label: string;
  }

  let { checked, onChange, disabled = false, label }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onChange(!checked)}
  class="w-8 h-4 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed {checked
    ? 'bg-success'
    : 'bg-line/15'}"
>
  <span
    class="absolute top-0.5 w-3 h-3 rounded-full bg-on-accent transition-all shadow-sm"
    style="left: {checked ? '18px' : '3px'};"
  ></span>
</button>
