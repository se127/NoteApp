import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const DELETE_FAILED_MESSAGE = "حذف یادداشت ناموفق بود";
const NO_BODY_MESSAGE = "متن یادداشت خالی است";

type NoteCardProps = {
  note: Note;
  onDelete: (id: number) => Promise<unknown>;
};

/**
 * One note in the list, with its own delete confirmation.
 *
 * The dialog lives here rather than on the list page so that it closes over
 * this specific note. That is what lets the description always name the note:
 * `note.title` is always defined, so it needs no null-guard. A dialog owned by
 * the page cannot avoid the guard, because the note it refers to is null
 * whenever the dialog is closed.
 */
export function NoteCard({ note, onDelete }: NoteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      setDeleteError(null);
      setIsOpen(false);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : DELETE_FAILED_MESSAGE,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{note.title}</p>
        {note.body !== "" ? (
          // line-clamp sets display:-webkit-box and -webkit-line-clamp:2, so
          // the body is capped at two lines with an ellipsis. It coexists with
          // whitespace-pre-line, which is why newlines in the note still break.
          <p className="mt-2 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
            {note.body}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground/70">
            {NO_BODY_MESSAGE}
          </p>
        )}
      </div>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={`گزینه‌ های یادداشت ${note.title}`}
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent align="end" side="right">
            گزینه ها
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/notes/${note.id}/edit`}>
              <Pencil className="size-4" />
              ویرایش
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleteError(null);
              /*
               * Deferred by a tick: Radix marks the body pointer-events: none
               * while a menu is open, and opening the dialog in the same tick
               * makes it swallow the interaction that dismisses the menu.
               */
              setTimeout(() => setIsOpen(true));
            }}
          >
            <Trash2 className="size-4" />
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              آیا از حذف این یادداشت مطمئن هستید؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{note.title}» برای همیشه حذف می‌شود و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          {/*
           * No justify override: shadcn's AlertDialogFooter already ships
           * sm:justify-end, which in RTL resolves to the left.
           */}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>انصراف</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={(event) => {
                // Keep the dialog mounted until the delete resolves.
                event.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "در حال حذف..." : "بله"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
