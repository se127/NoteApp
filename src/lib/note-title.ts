import type { Note } from "@/lib/notes";

const EMPTY_TITLE = "بدون عنوان";

export function noteTitle(note: Note): string {
  return note.title.trim() === "" ? EMPTY_TITLE : note.title;
}
