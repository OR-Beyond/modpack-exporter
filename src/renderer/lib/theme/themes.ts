/**
 * Theme registry — the single source of truth for every theme.
 *
 * Tokens are CSS custom property values: color channels are bare RGB triplets
 * (`"30 30 30"`) so Tailwind can layer opacity on top via
 * `rgb(var(--color-x) / <alpha-value>)`; scrollbar tokens are full rgba
 * strings. ThemeProvider applies the active theme's tokens as inline custom
 * properties on <html>, so adding a theme here is all that's needed to expose
 * it in the settings grid.
 */

export interface ThemeDefinition {
  /** Stable id persisted in localStorage (`orb.theme`). */
  id: string;
  /** Display name shown in the settings grid. */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  /** Native `color-scheme` — controls form controls and scrollbars. */
  colorScheme: 'dark' | 'light';
  /** CSS custom property values (keys include the leading `--`). */
  tokens: Record<string, string>;
}

export const THEMES = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'The default appearance — low-light, high contrast.',
    colorScheme: 'dark',
    tokens: {
      '--color-background': '30 30 30',
      '--color-foreground': '255 255 255',
      '--color-card': '38 38 42',
      '--color-card-foreground': '255 255 255',
      '--color-muted': '169 169 171',
      '--color-muted-foreground': '139 148 158',
      '--color-subtle': '24 24 26',
      '--color-line': '255 255 255',
      '--color-line-strong': '48 54 61',
      '--color-ring': '8 144 254',
      '--color-primary': '8 144 254',
      '--color-primary-hover': '26 157 255',
      '--color-link': '88 166 255',
      '--color-success': '32 172 100',
      '--color-success-strong': '35 134 54',
      '--color-warning': '255 168 9',
      '--color-warning-soft': '210 153 29',
      '--color-danger': '248 81 73',
      '--color-danger-strong': '218 54 51',
      '--color-brand': '226 71 41',
      '--color-brand-end': '255 63 110',
      '--color-overlay': '0 0 0',
      '--color-on-accent': '255 255 255',
      '--color-on-warning': '30 30 30',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.2)',
    },
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Bright surfaces for daytime use.',
    colorScheme: 'light',
    tokens: {
      '--color-background': '255 255 255',
      '--color-foreground': '31 35 40',
      '--color-card': '246 248 250',
      '--color-card-foreground': '31 35 40',
      '--color-muted': '89 99 110',
      '--color-muted-foreground': '129 139 152',
      '--color-subtle': '240 244 248',
      '--color-line': '0 0 0',
      '--color-line-strong': '209 217 224',
      '--color-ring': '9 105 218',
      '--color-primary': '9 105 218',
      '--color-primary-hover': '8 94 196',
      '--color-link': '9 105 218',
      '--color-success': '26 127 55',
      '--color-success-strong': '26 127 55',
      '--color-warning': '154 103 0',
      '--color-warning-soft': '154 103 0',
      '--color-danger': '207 34 46',
      '--color-danger-strong': '207 34 46',
      '--color-brand': '226 71 41',
      '--color-brand-end': '255 63 110',
      '--color-overlay': '0 0 0',
      '--color-on-accent': '255 255 255',
      '--color-on-warning': '30 30 30',
      '--scrollbar-thumb': 'rgba(0, 0, 0, 0.18)',
      '--scrollbar-thumb-hover': 'rgba(0, 0, 0, 0.3)',
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum contrast — near-black surfaces, vivid accents.',
    colorScheme: 'dark',
    tokens: {
      '--color-background': '10 10 12',
      '--color-foreground': '255 255 255',
      '--color-card': '20 20 24',
      '--color-card-foreground': '255 255 255',
      '--color-muted': '200 200 205',
      '--color-muted-foreground': '175 178 184',
      '--color-subtle': '14 14 17',
      '--color-line': '255 255 255',
      '--color-line-strong': '110 115 125',
      '--color-ring': '60 170 255',
      '--color-primary': '40 150 255',
      '--color-primary-hover': '70 175 255',
      '--color-link': '120 190 255',
      '--color-success': '50 220 130',
      '--color-success-strong': '35 165 85',
      '--color-warning': '255 190 40',
      '--color-warning-soft': '230 170 30',
      '--color-danger': '255 90 80',
      '--color-danger-strong': '235 60 50',
      '--color-brand': '240 60 30',
      '--color-brand-end': '255 60 110',
      '--color-overlay': '0 0 0',
      '--color-on-accent': '255 255 255',
      '--color-on-warning': '10 10 12',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.3)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.45)',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Blue-tinted dark palette — softer on the eyes at night.',
    colorScheme: 'dark',
    tokens: {
      '--color-background': '12 17 29',
      '--color-foreground': '214 225 242',
      '--color-card': '20 28 45',
      '--color-card-foreground': '214 225 242',
      '--color-muted': '150 163 188',
      '--color-muted-foreground': '122 135 160',
      '--color-subtle': '16 22 36',
      '--color-line': '255 255 255',
      '--color-line-strong': '52 63 89',
      '--color-ring': '96 165 250',
      '--color-primary': '70 140 240',
      '--color-primary-hover': '90 165 255',
      '--color-link': '110 175 255',
      '--color-success': '50 200 130',
      '--color-success-strong': '35 155 90',
      '--color-warning': '250 180 40',
      '--color-warning-soft': '220 160 30',
      '--color-danger': '255 90 90',
      '--color-danger-strong': '235 60 60',
      '--color-brand': '235 80 50',
      '--color-brand-end': '255 80 130',
      '--color-overlay': '0 0 0',
      '--color-on-accent': '255 255 255',
      '--color-on-warning': '20 25 40',
      '--scrollbar-thumb': 'rgba(214, 225, 242, 0.14)',
      '--scrollbar-thumb-hover': 'rgba(214, 225, 242, 0.22)',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Warm paper-toned light theme.',
    colorScheme: 'light',
    tokens: {
      '--color-background': '250 244 232',
      '--color-foreground': '60 48 36',
      '--color-card': '255 251 242',
      '--color-card-foreground': '60 48 36',
      '--color-muted': '130 115 95',
      '--color-muted-foreground': '150 134 112',
      '--color-subtle': '244 235 218',
      '--color-line': '0 0 0',
      '--color-line-strong': '215 200 175',
      '--color-ring': '176 108 40',
      '--color-primary': '176 108 40',
      '--color-primary-hover': '160 96 32',
      '--color-link': '140 90 30',
      '--color-success': '90 140 60',
      '--color-success-strong': '80 125 50',
      '--color-warning': '190 130 20',
      '--color-warning-soft': '190 130 20',
      '--color-danger': '200 70 50',
      '--color-danger-strong': '200 70 50',
      '--color-brand': '200 80 45',
      '--color-brand-end': '230 90 130',
      '--color-overlay': '0 0 0',
      '--color-on-accent': '255 255 255',
      '--color-on-warning': '60 48 36',
      '--scrollbar-thumb': 'rgba(60, 48, 36, 0.18)',
      '--scrollbar-thumb-hover': 'rgba(60, 48, 36, 0.3)',
    },
  },
] as const satisfies readonly ThemeDefinition[];

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME = THEMES[0];

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some(t => t.id === value);
}
