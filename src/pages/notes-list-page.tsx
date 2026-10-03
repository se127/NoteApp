import { Loader2, NotebookPen, Plus } from "lucide-react";
import { Link } from "react-router";

import { NoteCard } from "@/components/note-card";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";

const EMPTY_MESSAGE = "هیچ یادداشتی یافت نشد";

export function NotesListPage() {
  const { notes, isLoading, error, remove } = useNotes();

  /*
   * Built as one string rather than a sibling <span> inside the heading: JSX
   * strips the newline and indentation between a text line and a following
   * expression, which would swallow the space before the bracket. Blank while
   * loading, so the count does not flash ٠ before the first list arrives.
   */
  const countLabel = isLoading
    ? ""
    : ` (${notes.length.toLocaleString("fa-IR")})`;

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">
          یادداشت‌ ها{countLabel}
        </h1>
        <Button asChild>
          <Link to="/notes/new">
            <Plus className="size-4" />
            افزودن
          </Link>
        </Button>
      </header>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
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
            <NoteCard key={note.id} note={note} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
