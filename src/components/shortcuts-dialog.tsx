import { Keyboard } from "lucide-react";

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";

const SHORTCUTS_LABEL = "کلیدهای میان بر";
const CLOSE_HINT = "برای بستن این پنجره کلید Esc را بزنید.";

export function ShortcutsDialog() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" aria-label={SHORTCUTS_LABEL}>
              <Keyboard className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" align="end">
          {SHORTCUTS_LABEL}
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{SHORTCUTS_LABEL}</DialogTitle>
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
                    <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs whitespace-nowrap">
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
