import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export type ThemeContextValue = {
  /** The user's choice, which may be "system". */
  theme: Theme;
  /** What "system" currently resolves to, i.e. the theme actually applied. */
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

/** Key used for the localStorage fallback, e.g. when running in a plain browser. */
export const THEME_STORAGE_KEY = "note-app-theme";

/** The bridge exposed by electron/preload.mjs, when running inside Electron. */
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

/**
 * Read the persisted choice. Prefers the Electron bridge, which is stored in
 * userData and therefore survives the dev-server origin changing; falls back to
 * localStorage so `bun run dev:web` works in a plain browser.
 */
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

/** Persist the choice through whichever bridge is available. */
export function persistTheme(theme: Theme): void {
  const bridge = getElectronBridge();

  if (bridge) {
    bridge.theme.set(theme);
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for
    // this session, it just will not be remembered.
  }
}
