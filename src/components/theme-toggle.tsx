import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ThemeAnimationType,
  useModeAnimation,
} from "react-theme-switch-animation";

import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  readSystemTheme,
  resolveTheme,
  useTheme,
  type Theme,
} from "@/lib/theme";
import { isShortcut, THEME_SHORTCUT } from "@/lib/shortcuts";

const OPTIONS = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تاریک", icon: Moon },
  { value: "system", label: "سیستم", icon: Monitor },
] as const satisfies ReadonlyArray<{
  value: Theme;
  label: string;
  icon: typeof Sun;
}>;

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const intentRef = useRef<Theme | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((wasOpen) => !wasOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, THEME_SHORTCUT)) return;

      event.preventDefault();
      toggleMenu();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [toggleMenu]);

  const { ref, toggleSwitchTheme } = useModeAnimation({
    animationType: ThemeAnimationType.CIRCLE,
    isDarkMode: resolvedTheme === "dark",
    onDarkModeChange: (isDark) => {
      const next = intentRef.current ?? (isDark ? "dark" : "light");
      intentRef.current = null;
      setTheme(next);
    },
    duration: 300,
  });

  const handleValueChange = (value: string) => {
    const next = value as Theme;

    if (resolveTheme(next, readSystemTheme()) === resolvedTheme) {
      setTheme(next);
      return;
    }

    intentRef.current = next;
    void toggleSwitchTheme();
  };

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <ShortcutTooltip shortcut={THEME_SHORTCUT} open={isHovered}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            size="icon"
            aria-label="تغییر پوسته"
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            {resolvedTheme === "dark" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </ShortcutTooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={handleValueChange}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="gap-2"
            >
              <option.icon className="size-4" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
