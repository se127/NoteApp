import { useCallback, useEffect, useState } from "react";

import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENTS, ACCENT_LABELS, useTheme } from "@/lib/theme";
import { ACCENT_SHORTCUT, isShortcut } from "@/lib/shortcuts";

export function AccentToggle() {
  const { accent, setAccent } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((wasOpen) => !wasOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, ACCENT_SHORTCUT)) return;

      event.preventDefault();
      toggleMenu();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [toggleMenu]);

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <ShortcutTooltip shortcut={ACCENT_SHORTCUT} open={isHovered}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="تغییر رنگ"
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            <span
              data-accent={accent}
              className="size-4 rounded-full bg-sidebar-primary"
            />
          </Button>
        </DropdownMenuTrigger>
      </ShortcutTooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={accent}
          onValueChange={(value) => setAccent(value as typeof accent)}
        >
          {ACCENTS.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="gap-2"
            >
              <span
                data-accent={option}
                className="size-4 rounded-full bg-sidebar-primary"
              />
              {ACCENT_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
