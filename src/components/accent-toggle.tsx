import { useState } from "react";

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
import { ACCENTS, ACCENT_LABELS, useTheme } from "@/lib/theme";

export function AccentToggle() {
  const { accent, setAccent } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <DropdownMenu>
      <Tooltip open={isHovered}>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          تغییر رنگ
        </TooltipContent>
      </Tooltip>
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
