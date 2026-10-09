import { Route, Routes } from "react-router";

import { NotesProvider } from "@/components/notes-provider";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { EditNotePage } from "@/pages/edit-note-page";
import { NotesPage } from "@/pages/notes-page";

function App() {
  return (
    <NotesProvider>
      <AppShell />
    </NotesProvider>
  );
}

function AppShell() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-between gap-2 px-6 pt-4 pb-3">
        <ShortcutsDialog />
        <ThemeToggle />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
        <Routes>
          <Route path="/" element={<NotesPage />} />
          <Route path="/notes/:id/edit" element={<EditNotePage />} />
          <Route path="*" element={<NotesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
