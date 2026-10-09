import { Ellipsis, Trash2 } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";

import { DeleteNoteDialog } from "@/components/delete-note-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { noteTitle } from "@/lib/note-title";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const LIST_LABEL = "یادداشت‌ها";
const TITLE_HEADING = "عنوان";
const CREATED_HEADING = "زمان ایجاد";
const ACTIONS_HEADING = "گزینه ها";
const TITLE_COLUMN = "w-1/2";
const CREATED_COLUMN = "w-1/4";
const ACTIONS_COLUMN = "w-1/4";
const TABLE_WIDTH = "w-full table-fixed";

export function NotesTable({ notes }: { notes: Note[] }) {
  return (
    <Table aria-label={LIST_LABEL} className={TABLE_WIDTH}>
      <TableHeader>
        <TableRow>
          <TableHead className={TITLE_COLUMN}>{TITLE_HEADING}</TableHead>
          <TableHead className={cn(CREATED_COLUMN, "text-center")}>
            {CREATED_HEADING}
          </TableHead>
          <TableHead className={ACTIONS_COLUMN}>
            <span className="sr-only">{ACTIONS_HEADING}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.map((note) => (
          <NoteTableRow key={note.id} note={note} />
        ))}
      </TableBody>
    </Table>
  );
}

function NoteTableRow({ note }: { note: Note }) {
  const { isSaving } = useNotesStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const title = noteTitle(note);

  return (
    <TableRow>
      <TableCell
        className={cn("relative align-top whitespace-normal", TITLE_COLUMN)}
      >
        <NavLink
          to={`/notes/${note.id}/edit`}
          aria-disabled={isSaving}
          className={cn(
            "block break-words outline-none after:absolute after:inset-0 focus-visible:underline",
            note.title.trim() === "" && "text-muted-foreground",
            isSaving && "pointer-events-none",
          )}
        >
          {title}
        </NavLink>
      </TableCell>

      <TableCell
        className={cn(
          "text-center align-top text-muted-foreground",
          CREATED_COLUMN,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <time className="cursor-default">
              {formatRelativeTime(note.createdAt)}
            </time>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {formatAbsoluteTime(note.createdAt)}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      <TableCell className={cn("text-end align-top", ACTIONS_COLUMN)}>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <Tooltip open={isHovered && !isMenuOpen}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`گزینه های یادداشت ${title}`}
                  disabled={isSaving}
                  onPointerEnter={() => setIsHovered(true)}
                  onPointerLeave={() => setIsHovered(false)}
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>گزینه ها</TooltipContent>
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
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      <DeleteNoteDialog
        note={note}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </TableRow>
  );
}
