import { Inbox, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { NotesTable } from "@/components/notes-table";
import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { Button } from "@/components/ui/button";
import { useNotesStore } from "@/lib/notes-store";
import { isShortcut, NEW_NOTE_SHORTCUT } from "@/lib/shortcuts";

const EMPTY_MESSAGE = "هیچ یادداشتی نیست";
const CREATE_FAILED_MESSAGE = "ساخت یادداشت ناموفق بود";

export function NotesPage() {
  const navigate = useNavigate();
  const { notes, isLoading, error, create, isSaving } = useNotesStore();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      if (!isShortcut(event, NEW_NOTE_SHORTCUT)) return;

      event.preventDefault();
      void handleNewNote();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleNewNote]);

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

      <div className="min-h-0 flex-1 overflow-auto px-6 pt-4 pb-6">
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
          <NotesTable notes={notes} />
        )}
      </div>
    </div>
  );
}
