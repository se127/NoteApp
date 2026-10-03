import { Route, Routes } from "react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { EditNotePage } from "@/pages/edit-note-page";
import { NewNotePage } from "@/pages/new-note-page";
import { NotesListPage } from "@/pages/notes-list-page";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Physically top-left. Swap `left-0` for `start-0` to follow the RTL
          text direction instead. */}
      <div className="absolute top-0 left-0 z-10 p-4">
        <ThemeToggle />
      </div>

      {/* pt-16 keeps page content clear of the absolute theme button. */}
      <div className="pt-12">
        <Routes>
          <Route path="/" element={<NotesListPage />} />
          <Route path="/notes/new" element={<NewNotePage />} />
          <Route path="/notes/:id/edit" element={<EditNotePage />} />
          <Route path="*" element={<NotesListPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
