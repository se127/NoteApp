import { useCallback, useState } from "react";

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
import { useNotesStore } from "@/lib/notes-store";
import { formatPersianNumber } from "@/lib/persian-number";

const TITLE = "حذف یادداشت های انتخاب شده";
const WARNING = "برای همیشه حذف می شوند و قابل بازگشت نیستند.";
const DELETE_FAILED_MESSAGE = "حذف یادداشت ها ناموفق بود";

export function DeleteSelectedNotesDialog({
  ids,
  open,
  onOpenChange,
  onDeleted,
}: {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { removeMany } = useNotesStore();

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
      await removeMany(ids);

      onDeleted();
      onOpenChange(false);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : DELETE_FAILED_MESSAGE,
      );
    } finally {
      setIsDeleting(false);
    }
  }, [ids, onDeleted, onOpenChange, removeMany]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE}</AlertDialogTitle>
          <AlertDialogDescription>
            {`${formatPersianNumber(ids.length)} یادداشت ${WARNING}`}
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
