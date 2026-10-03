import { createContext, useContext } from "react";

import type { NewNote, Note } from "@/lib/notes";

export type NotesStore = {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  create: (note: NewNote) => Promise<Note>;
  remove: (id: number) => Promise<boolean>;
  update: (id: number, note: NewNote) => Promise<Note | null>;
};

export const NotesStoreContext = createContext<NotesStore | null>(null);

export function useNotesStore(): NotesStore {
  const store = useContext(NotesStoreContext);

  if (store === null) {
    throw new Error("useNotesStore must be used within a NotesProvider");
  }

  return store;
}
