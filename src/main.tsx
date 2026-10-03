import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HashRouter } from "react-router";

import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <DirectionProvider dir="rtl">
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </DirectionProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
