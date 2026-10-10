import { Keyboard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SHORTCUT_GROUPS,
  SHORTCUTS_DIALOG_SHORTCUT,
  isShortcut,
} from "@/lib/shortcuts";

const TRIGGER_LABEL = SHORTCUTS_DIALOG_SHORTCUT.label;
const CLOSE_HINT = "برای بستن این پنجره کلید Esc را بزنید.";

export function ShortcutsDialog() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDialog = useCallback(() => {
    setIsOpen((wasOpen) => !wasOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, SHORTCUTS_DIALOG_SHORTCUT)) return;

      event.preventDefault();
      toggleDialog();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [toggleDialog]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <ShortcutTooltip shortcut={SHORTCUTS_DIALOG_SHORTCUT}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" aria-label={TRIGGER_LABEL}>
            <Keyboard className="size-4" />
          </Button>
        </DialogTrigger>
      </ShortcutTooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TRIGGER_LABEL}</DialogTitle>
          <DialogDescription>{CLOSE_HINT}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pe-1">
          {SHORTCUT_GROUPS.map(({ heading, shortcuts }) => (
            <section key={heading} className="grid gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                {heading}
              </h3>
              <ul className="grid gap-2">
                {shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.combination}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {shortcut.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {shortcut.description}
                      </span>
                    </span>
                    <kbd
                      dir="ltr"
                      className="shrink-0 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs whitespace-nowrap"
                    >
                      {shortcut.combination}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
