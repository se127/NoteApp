import { Monitor, Moon, Sun } from "lucide-react";
import { useRef } from "react";
import {
  ThemeAnimationType,
  useModeAnimation,
} from "react-theme-switch-animation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  readSystemTheme,
  resolveTheme,
  useTheme,
  type Theme,
} from "@/lib/theme";

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
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              size="icon"
              aria-label="تغییر پوسته"
            >
              {resolvedTheme === "dark" ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" align="end">
          تغییر پوسته
        </TooltipContent>
      </Tooltip>
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
