import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HashRouter } from "react-router";

import { DirectionProvider } from "@/components/ui/direction";
import { ThemeProvider } from "@/components/theme-provider";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* HashRouter, not BrowserRouter: the packaged app is served over
          file://, where path-based routes cannot be resolved on reload. */}
      <HashRouter>
        <DirectionProvider dir="rtl">
          <App />
        </DirectionProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
