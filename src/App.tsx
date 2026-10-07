import { Route, Routes } from "react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { NotesProvider } from "@/components/notes-provider";
import { EditNotePage } from "@/pages/edit-note-page";
import { WelcomePage } from "@/pages/welcome-page";

function App() {
  return (
    <NotesProvider>
      <AppShell />
    </NotesProvider>
  );
}

function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/notes/:id/edit" element={<EditNotePage />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
