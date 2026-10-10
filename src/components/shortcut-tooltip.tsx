import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Shortcut } from "@/lib/shortcuts";

export function ShortcutTooltip({
  shortcut,
  side = "top",
  open,
  combinationOnly = false,
  tooltipText,
  children,
}: {
  shortcut: Shortcut;
  side?: "bottom" | "left" | "right" | "top";
  open?: boolean;
  combinationOnly?: boolean;
  tooltipText?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {!combinationOnly && (
          <span>{tooltipText ?? shortcut.tooltipLabel ?? shortcut.label}</span>
        )}
        <kbd
          data-slot="kbd"
          dir="ltr"
          className="rounded-sm bg-background/20 px-1 py-0.5 font-mono text-[10px] leading-none"
        >
          {shortcut.combination}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
