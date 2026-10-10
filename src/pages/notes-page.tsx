import { Inbox, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { DeleteSelectedNotesDialog } from "@/components/delete-selected-notes-dialog";
import { NotesTable } from "@/components/notes-table";
import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import { useNotesStore } from "@/lib/notes-store";
import { formatPersianNumber } from "@/lib/persian-number";
import {
  DELETE_SELECTED_SHORTCUT,
  isShortcut,
  NEW_NOTE_SHORTCUT,
  SELECT_MODE_SHORTCUT,
} from "@/lib/shortcuts";

const EMPTY_MESSAGE = "هیچ یادداشتی نیست";
const CREATE_FAILED_MESSAGE = "ساخت یادداشت ناموفق بود";
const DELETE_SELECTED_LABEL = "حذف یادداشت های انتخاب شده";

export function NotesPage() {
  const navigate = useNavigate();
  const { notes, isLoading, error, create, isSaving } = useNotesStore();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteSelectedLabel = `${DELETE_SELECTED_LABEL} (${formatPersianNumber(selectedIds.length)})`;

  const handleToggleSelectMode = useCallback(() => {
    setIsSelecting((previous) => !previous);
    setSelectedIds([]);
  }, []);

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((selected) => selected !== id)
        : [...previous, id],
    );
  }, []);

  const handleDeleted = useCallback(() => {
    setSelectedIds([]);
    setIsSelecting(false);
  }, []);

  const handleNewNote = useCallback(async () => {
    if (isCreating || isSaving) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const note = await create({ title: "", body: "" });
      navigate(`/notes/${note.id}/edit`);
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : CREATE_FAILED_MESSAGE,
      );
    } finally {
      setIsCreating(false);
    }
  }, [create, isCreating, isSaving, navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isShortcut(event, SELECT_MODE_SHORTCUT)) {
        event.preventDefault();
        handleToggleSelectMode();
        return;
      }

      if (isShortcut(event, DELETE_SELECTED_SHORTCUT)) {
        if (selectedIds.length === 0 || isSaving) return;

        event.preventDefault();
        setIsDeleteDialogOpen(true);
        return;
      }

      if (!isShortcut(event, NEW_NOTE_SHORTCUT)) return;

      event.preventDefault();
      void handleNewNote();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleNewNote, handleToggleSelectMode, isSaving, selectedIds.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="px-6">
        <ShortcutTooltip shortcut={NEW_NOTE_SHORTCUT}>
          <Button onClick={handleNewNote} disabled={isCreating || isSaving}>
            <Plus className="size-4" />
            {isCreating ? "در حال ساخت..." : NEW_NOTE_SHORTCUT.label}
          </Button>
        </ShortcutTooltip>
        {createError !== null && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {createError}
          </p>
        )}
      </div>

      <div className="mx-6 mt-4 mb-6 min-h-0 flex-1 overflow-auto">
        {error !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بارگذاری...
          </p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
            <Inbox className="size-6" />
            <p className="text-sm">{EMPTY_MESSAGE}</p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <ShortcutTooltip shortcut={SELECT_MODE_SHORTCUT}>
                <Button
                  size="icon"
                  variant={isSelecting ? "default" : "outline"}
                  aria-label={SELECT_MODE_SHORTCUT.label}
                  aria-pressed={isSelecting}
                  onClick={handleToggleSelectMode}
                >
                  <ListChecks />
                </Button>
              </ShortcutTooltip>

              {selectedIds.length > 0 && (
                <ShortcutTooltip
                  shortcut={DELETE_SELECTED_SHORTCUT}
                  combinationOnly
                >
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    {deleteSelectedLabel}
                  </Button>
                </ShortcutTooltip>
              )}
            </div>

            <NotesTable
              notes={notes}
              isSelecting={isSelecting}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </>
        )}
      </div>

      <DeleteSelectedNotesDialog
        ids={selectedIds}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
