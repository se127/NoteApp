import { useNotes } from "@/hooks/use-notes";
import { NotesStoreContext } from "@/lib/notes-store";

export function NotesProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotesStoreContext.Provider value={useNotes()}>
      {children}
    </NotesStoreContext.Provider>
  );
}
