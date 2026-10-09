import { NavLink } from "react-router";

import { NoteActionsMenu } from "@/components/note-actions-menu";
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
import {
  formatAbsoluteTime,
  formatRelativeTime,
  hasBeenEdited,
} from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const LIST_LABEL = "یادداشت‌ها";
const TITLE_HEADING = "عنوان";
const CREATED_HEADING = "زمان ایجاد";
const ACTIONS_HEADING = "گزینه ها";
const EDITED_LABEL = "ویرایش شده:";
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

  const title = noteTitle(note);
  const wasEdited = hasBeenEdited(note.createdAt, note.updatedAt);

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

        {wasEdited && (
          <Tooltip>
            <TooltipTrigger asChild>
              <time
                dateTime={note.updatedAt}
                className="relative z-10 mt-1 block w-fit cursor-default text-xs text-muted-foreground"
              >
                {`${EDITED_LABEL} ${formatRelativeTime(note.updatedAt)}`}
              </time>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {formatAbsoluteTime(note.updatedAt)}
            </TooltipContent>
          </Tooltip>
        )}
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
        <NoteActionsMenu note={note} disabled={isSaving} />
      </TableCell>
    </TableRow>
  );
}
