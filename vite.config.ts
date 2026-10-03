import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs. The packaged app loads dist/index.html over file://,
  // where a leading "/assets/..." resolves against the drive root instead of
  // the app folder and 404s, leaving a blank window. "./" works for both the
  // dev server and the packaged build. Pairs with HashRouter in src/main.tsx.
  base: "./",
  plugins: [react({ compiler: true }), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
