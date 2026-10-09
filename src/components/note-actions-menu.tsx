import { Ellipsis, Trash2 } from "lucide-react";
import { useState } from "react";

import { DeleteNoteDialog } from "@/components/delete-note-dialog";
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

const ACTIONS_LABEL = "گزینه ها";
const DELETE_LABEL = "حذف";

export function NoteActionsMenu({
  note,
  disabled = false,
}: {
  note: Note;
  disabled?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Tooltip open={isHovered && !isMenuOpen}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
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
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{ACTIONS_LABEL}</TooltipContent>
        </Tooltip>
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
