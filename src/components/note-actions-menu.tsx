import { Ellipsis, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DeleteNoteDialog } from "@/components/delete-note-dialog";
import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Note } from "@/lib/notes";
import { noteTitle } from "@/lib/note-title";
import { isShortcut, type Shortcut } from "@/lib/shortcuts";

const ACTIONS_LABEL = "گزینه ها";
const DELETE_LABEL = "حذف";

export function NoteActionsMenu({
  note,
  disabled = false,
  shortcut,
}: {
  note: Note;
  disabled?: boolean;
  shortcut?: Shortcut;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  useEffect(() => {
    if (shortcut === undefined || disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, shortcut)) return;

      event.preventDefault();
      openMenu();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [disabled, openMenu, shortcut]);

  const trigger = (
    <Button
      variant="outline"
      size="icon"
      aria-label={`گزینه های یادداشت ${noteTitle(note)}`}
      disabled={disabled}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <Ellipsis />
    </Button>
  );

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        {shortcut === undefined ? (
          <Tooltip open={isHovered && !isMenuOpen}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{ACTIONS_LABEL}</TooltipContent>
          </Tooltip>
        ) : (
          <ShortcutTooltip
            shortcut={shortcut}
            side="bottom"
            open={isHovered && !isMenuOpen ? true : undefined}
          >
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </ShortcutTooltip>
        )}
        <DropdownMenuContent
          side="bottom"
          align="end"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setIsDialogOpen(true);
            }}
          >
            <Trash2 />
            {DELETE_LABEL}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteNoteDialog
        note={note}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
