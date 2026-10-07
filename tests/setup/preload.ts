import { afterEach } from "bun:test";

process.env["RTL_SKIP_AUTO_CLEANUP"] = "true";

import "./dom";

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});
