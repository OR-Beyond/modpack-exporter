/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,jsx,js,html}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      // Opacity modifiers only resolve against this scale. Values missing here
      // (4, 6, 8, 12) silently drop the generated rule, so border-line/6 etc.
      // would fall back to the opaque preflight default — keep the scale in sync
      // with the /N usages across the codebase.
      opacity: {
        4: '0.04',
        6: '0.06',
        8: '0.08',
        12: '0.12',
      },
      colors: {
        // Design tokens — see src/renderer/lib/styles/globals.css.
        // Channel triplets are exposed as `rgb(var(--color-x) / <alpha-value>)`
        // so utilities support opacity modifiers: bg-card/50, border-line/8.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        'card-foreground': 'rgb(var(--color-card-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        subtle: 'rgb(var(--color-subtle) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--color-line-strong) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
        link: 'rgb(var(--color-link) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-strong': 'rgb(var(--color-success-strong) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-strong': 'rgb(var(--color-danger-strong) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-end': 'rgb(var(--color-brand-end) / <alpha-value>)',
        overlay: 'rgb(var(--color-overlay) / <alpha-value>)',
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
        'on-warning': 'rgb(var(--color-on-warning) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
