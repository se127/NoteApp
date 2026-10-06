import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { NotesStore } from "@/lib/notes-store";
import { NotesStoreContext } from "@/lib/notes-store";

export function Providers({
  children,
  route,
  store,
  withTheme,
}: {
  children: ReactNode;
  route: string;
  store: NotesStore;
  withTheme: boolean;
}) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <NotesStoreContext.Provider value={store}>
        <TooltipProvider>
          {withTheme ? <ThemeProvider>{children}</ThemeProvider> : children}
        </TooltipProvider>
      </NotesStoreContext.Provider>
    </MemoryRouter>
  );
}
