/**
 * Electron preload script.
 *
 * Runs in an isolated context before the renderer loads. Only explicitly
 * bridged APIs are exposed on `window.noteApp` — never enable nodeIntegration
 * or dump `require` into the page.
 */
import { contextBridge } from "electron";

/** @type {Record<string, unknown>} */
const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld("noteApp", api);
