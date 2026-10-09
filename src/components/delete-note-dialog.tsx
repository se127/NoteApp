import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";

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
import type { Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { noteTitle } from "@/lib/note-title";

const QUESTION = "آیا از حذف این یادداشت مطمئن هستید؟";
const WARNING = "برای همیشه حذف می‌شود و قابل بازگشت نیست.";
const DELETE_FAILED_MESSAGE = "حذف یادداشت ناموفق بود";

export function DeleteNoteDialog({
  note,
  open,
  onOpenChange,
}: {
  note: Note;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { remove } = useNotesStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setDeleteError(null);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await remove(note.id);

      if (location.pathname === `/notes/${note.id}/edit`) {
        navigate("/");
      }

      onOpenChange(false);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : DELETE_FAILED_MESSAGE,
      );
    } finally {
      setIsDeleting(false);
    }
  }, [location.pathname, navigate, note.id, onOpenChange, remove]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{QUESTION}</AlertDialogTitle>
          <AlertDialogDescription>
            «{noteTitle(note)}» {WARNING}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError !== null && (
          <p role="alert" className="text-sm text-destructive">
            {deleteError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>انصراف</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? "در حال حذف..." : "بله"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
