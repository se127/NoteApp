/**
 * Electron preload script.
 *
 * CommonJS on purpose: sandboxed preloads are loaded as plain scripts by
 * Electron, so an ESM (.mjs) preload silently fails to load here and nothing
 * gets exposed to the page. Keeping sandbox: true is worth more than ESM.
 *
 * Only explicitly bridged APIs are exposed on `window.noteApp` — never enable
 * nodeIntegration or dump `require` into the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  theme: {
    // Answered synchronously via event.returnValue: the inline script in
    // index.html needs the persisted theme before first paint, and an async
    // round trip would flash the wrong theme.
    get: () => ipcRenderer.sendSync("theme:get"),
    set: (theme) => ipcRenderer.send("theme:set", theme),
  },
  notes: {
    list: () => ipcRenderer.invoke("notes:list"),
    create: (note) => ipcRenderer.invoke("notes:create", note),
    remove: (id) => ipcRenderer.invoke("notes:delete", id),
    // Fires when any window adds a note, so views can refetch.
    onChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("notes:changed", listener);
      return () => ipcRenderer.removeListener("notes:changed", listener);
    },
  },
};

contextBridge.exposeInMainWorld("noteApp", api);
