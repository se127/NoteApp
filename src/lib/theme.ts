import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

export const THEME_STORAGE_KEY = "note-app-theme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(
  theme: Theme,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return theme === "system" ? systemTheme : theme;
}

export type ElectronBridge = {
  theme: {
    get: () => Theme;
    set: (theme: Theme) => void;
  };
};

export function getElectronBridge(): ElectronBridge | null {
  if (typeof window === "undefined") return null;

  const bridge = (window as { noteApp?: ElectronBridge }).noteApp;
  return bridge?.theme ? bridge : null;
}

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme | null {
  const bridge = getElectronBridge();
  if (bridge) {
    const theme = bridge.theme.get();
    return isTheme(theme) ? theme : null;
  }

  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

export function persistTheme(theme: Theme): void {
  const bridge = getElectronBridge();

  if (bridge) {
    bridge.theme.set(theme);
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}
