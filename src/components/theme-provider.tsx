import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DARK_QUERY,
  ThemeContext,
  persistTheme,
  readStoredTheme,
  readSystemTheme,
  resolveTheme,
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

  const setTheme = useCallback((next: Theme) => {
    persistTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
