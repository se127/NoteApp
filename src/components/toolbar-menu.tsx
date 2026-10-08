import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import { type ToolbarCommand, toolbarShortcut } from "@/lib/shortcuts";
import { useToolbarCommand } from "@/lib/toolbar-commands";
import { cn } from "@/lib/utils";

export type ToolbarMenuOption<T> = {
  value: T;
  label: string;
  icon: LucideIcon;
};

export function ToolbarMenu<T extends string | null>({
  command,
  options,
  activeValue,
  triggerIcon,
  onSelect,
}: {
  command: ToolbarCommand;
  options: ToolbarMenuOption<T>[];
  activeValue: T;
  triggerIcon: LucideIcon;
  onSelect: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const TriggerIcon = triggerIcon;
  const shortcut = toolbarShortcut(command);

  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);

  useToolbarCommand(command, toggle);

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
      <ShortcutTooltip shortcut={shortcut}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={shortcut.label}
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
          className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
        >
          <TriggerIcon className="size-4" />
        </Button>
      </ShortcutTooltip>
      {open ? (
        <div
          role="menu"
          aria-label={shortcut.label}
          className="inset-inline-0 absolute top-full z-30 flex min-w-36 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {options.map((option) => {
            const ItemIcon = option.icon;

            return (
              <button
                key={option.value ?? shortcut.label}
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
