import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { THEMES, DEFAULT_THEME, isThemeId, type ThemeId } from './themes';

const STORAGE_KEY = 'orb.theme';

/**
 * Applies the theme's tokens as inline CSS custom properties on <html> plus the
 * `data-theme` attribute — also used pre-render to avoid a flash on startup.
 * Tokens live in themes.ts (single source of truth); globals.css only provides
 * a minimal fallback for the first paint.
 */
export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES.find(t => t.id === themeId) ?? DEFAULT_THEME;
  const el = document.documentElement;
  el.dataset.theme = theme.id;
  el.style.colorScheme = theme.colorScheme;
  for (const [key, value] of Object.entries(theme.tokens)) {
    el.style.setProperty(key, value);
  }
}

/** Applies the persisted theme before React mounts (no flash on startup). */
export function initTheme(): void {
  applyTheme(readStoredTheme());
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

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME.id,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures — the theme still applies for this session.
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
