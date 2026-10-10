import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ACCENT_ATTRIBUTE,
  DARK_QUERY,
  DEFAULT_ACCENT,
  ThemeContext,
  persistAccent,
  persistTheme,
  readStoredAccent,
  readStoredTheme,
  readSystemTheme,
  resolveTheme,
  type Accent,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from "@/lib/theme";

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme() ?? defaultTheme,
  );
  const [accent, setAccentState] = useState<Accent>(
    () => readStoredAccent() ?? DEFAULT_ACCENT,
  );
  const [systemPreference, setSystemPreference] =
    useState<ResolvedTheme>(readSystemTheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () =>
      setSystemPreference(media.matches ? "dark" : "light");

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemPreference);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.setAttribute(ACCENT_ATTRIBUTE, accent);
  }, [accent]);

  const setTheme = useCallback((next: Theme) => {
    persistTheme(next);
    setThemeState(next);
  }, []);

  const setAccent = useCallback((next: Accent) => {
    persistAccent(next);
    setAccentState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, accent, setAccent }),
    [theme, resolvedTheme, setTheme, accent, setAccent],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
