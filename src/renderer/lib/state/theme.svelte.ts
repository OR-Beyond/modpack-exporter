/**
 * Theme state (runes module).
 *
 * Ports the old ThemeProvider: the active theme id lives in a rune so
 * components can read it live, and every change is applied to <html> as
 * inline CSS custom properties plus persisted to localStorage.
 */

import { THEMES, DEFAULT_THEME, isThemeId, type ThemeId } from '../theme/themes';

const STORAGE_KEY = 'orb.theme';

/**
 * Applies the theme's tokens as inline CSS custom properties on <html> plus the
 * `data-theme` attribute — also used pre-render to avoid a flash on startup.
 * Tokens live in themes.ts (single source of truth); globals.css only provides
 * a minimal fallback for the first paint.
 */
function applyTheme(themeId: ThemeId): void {
  const theme = THEMES.find(t => t.id === themeId) ?? DEFAULT_THEME;
  const el = document.documentElement;
  el.dataset.theme = theme.id;
  el.style.colorScheme = theme.colorScheme;
  for (const [key, value] of Object.entries(theme.tokens)) {
    el.style.setProperty(key, value);
  }
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && isThemeId(stored)) return stored;
  } catch {
    // localStorage unavailable — fall back to default.
  }
  return DEFAULT_THEME.id;
}

/** Applies the persisted theme before the app mounts (no flash on startup). */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}

let theme = $state<ThemeId>(readStoredTheme());

export const themeState = {
  get current(): ThemeId {
    return theme;
  },
  set(next: ThemeId): void {
    theme = next;
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures — the theme still applies for this session.
    }
  },
};
