import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export type Accent = "blue" | "green" | "orange";

export const ACCENTS: readonly Accent[] = ["blue", "green", "orange"];

export const DEFAULT_ACCENT: Accent = "blue";

export const ACCENT_LABELS: Record<Accent, string> = {
  blue: "آبی",
  green: "سبز",
  orange: "نارنجی",
};

export type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

const THEME_STORAGE_KEY = "NoteApp-theme";
const ACCENT_STORAGE_KEY = "NoteApp-accent";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const ACCENT_ATTRIBUTE = "data-accent";

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

type ElectronBridge = {
  theme: {
    get: () => Theme;
    set: (theme: Theme) => void;
    accent: {
      get: () => Accent;
      set: (accent: Accent) => void;
    };
  };
};

function getElectronBridge(): ElectronBridge | null {
  if (typeof window === "undefined") return null;

  const bridge = (window as { NoteApp?: ElectronBridge }).NoteApp;
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

function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent === value);
}

export function readStoredAccent(): Accent | null {
  const store = getElectronBridge()?.theme.accent;

  if (store) {
    const accent = store.get();
    return isAccent(accent) ? accent : null;
  }

  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return isAccent(stored) ? stored : null;
}

export function persistAccent(accent: Accent): void {
  const store = getElectronBridge()?.theme.accent;

  if (store) {
    store.set(accent);
    return;
  }

  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {}
}
