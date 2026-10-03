import { Loader2 } from "lucide-react";
import { useParams } from "react-router";

import { NoteEditor } from "@/components/note-editor";
import { useNotesStore } from "@/lib/notes-store";

const NOT_FOUND_MESSAGE = "یادداشت یافت نشد";

export function EditNotePage() {
  const { id } = useParams<{ id: string }>();
  const { notes, isLoading, error } = useNotesStore();

  if (error !== null) {
    return (
      <p role="alert" className="p-6 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        در حال بارگذاری...
      </p>
    );
  }

  const noteId = Number(id);
  const note = Number.isInteger(noteId)
    ? notes.find((candidate) => candidate.id === noteId)
    : undefined;

  if (note === undefined) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{NOT_FOUND_MESSAGE}</p>
    );
  }

  return <NoteEditor key={note.id} note={note} />;
}
