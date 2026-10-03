import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DirectionProvider } from "@/components/ui/direction";
import { ThemeProvider } from "@/components/theme-provider";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <DirectionProvider dir="rtl">
        <App />
      </DirectionProvider>
    </ThemeProvider>
  </StrictMode>,
);
