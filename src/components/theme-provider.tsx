import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ThemeContext,
  persistTheme,
  readStoredTheme,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  // Read storage during the initial render rather than in an effect: this is a
  // client-only app, and the inline script in index.html has already painted the
  // right theme, so state just needs to match what is on screen.
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme() ?? defaultTheme,
  );
  const [systemPreference, setSystemPreference] =
    useState<ResolvedTheme>(readSystemTheme);

  // Track OS changes. The setState happens inside the media query's event
  // handler, i.e. from an external event, not during the effect itself.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () =>
      setSystemPreference(media.matches ? "dark" : "light");

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Derived during render, so no effect (and no cascading render) is needed.
  const resolvedTheme = theme === "system" ? systemPreference : theme;

  // Drive the `.dark` class that the `dark:` variant in index.css keys off.
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
