import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ToolbarMenuOption<T> = {
  value: T;
  label: string;
  icon: LucideIcon;
};

export function ToolbarMenu<T extends string | null>({
  label,
  triggerLabel,
  options,
  activeValue,
  triggerIcon,
  onSelect,
}: {
  label: string;
  triggerLabel: string;
  options: ToolbarMenuOption<T>[];
  activeValue: T;
  triggerIcon: LucideIcon;
  onSelect: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const TriggerIcon = triggerIcon;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: Event) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);

    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
          >
            <TriggerIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="inset-inline-0 absolute top-full z-30 flex min-w-36 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {options.map((option) => {
            const ItemIcon = option.icon;

            return (
              <button
                key={option.value ?? label}
                type="button"
                role="menuitemradio"
                aria-label={option.label}
                aria-checked={option.value === activeValue}
                onClick={() => {
                  setOpen(false);
                  onSelect(option.value);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm text-popover-foreground outline-none hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground",
                  option.value === activeValue && "bg-muted text-foreground",
                )}
              >
                <ItemIcon className="size-4 shrink-0" />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
