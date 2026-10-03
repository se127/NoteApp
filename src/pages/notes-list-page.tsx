import { useState } from "react";
import { Link } from "react-router";
import { Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";

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
import { useNotes } from "@/hooks/use-notes";
import type { Note } from "@/lib/notes";

const EMPTY_MESSAGE = "هیچ یادداشتی یافت نشد";

export function NotesListPage() {
  const { notes, isLoading, error, remove } = useNotes();

  // The note awaiting confirmation, or null when the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (pendingDelete === null) return;

    setIsDeleting(true);
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "حذف یادداشت ناموفق بود",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">یادداشت‌ها</h1>
        <Button asChild>
          <Link to="/notes/new">
            <Plus className="size-4" />
            افزودن یادداشت
          </Link>
        </Button>
      </header>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {deleteError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری…
        </p>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          <NotebookPen className="size-8" />
          <p className="text-sm">{EMPTY_MESSAGE}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{note.title}</p>
                {note.body !== "" && (
                  <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                    {note.body}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label={`حذف یادداشت ${note.title}`}
                onClick={() => {
                  setDeleteError(null);
                  setPendingDelete(note);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>آیا از حذف یادداشت مطمئن هستید؟</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete !== null && (
                <>
                  «{pendingDelete.title}» برای همیشه حذف می‌شود و قابل بازگشت
                  نیست.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              {isDeleting ? "در حال حذف…" : "حذف"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
