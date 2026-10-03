import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Radix tooltips require a provider ancestor; one at the root covers
          every tooltip in the app. */}
      <TooltipProvider>
        <DirectionProvider dir="rtl">
          <App />
        </DirectionProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
