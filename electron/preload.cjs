const { contextBridge, ipcRenderer } = require("electron");

const api = {
  theme: {
    get: () => ipcRenderer.sendSync("theme:get"),
    set: (theme) => ipcRenderer.send("theme:set", theme),
    accent: {
      get: () => ipcRenderer.sendSync("accent:get"),
      set: (accent) => ipcRenderer.send("accent:set", accent),
    },
  },
  notes: {
    list: () => ipcRenderer.invoke("notes:list"),
    create: (note) => ipcRenderer.invoke("notes:create", note),
    remove: (id) => ipcRenderer.invoke("notes:delete", id),
    update: (id, note) => ipcRenderer.invoke("notes:update", { id, ...note }),
    updateSync: (id, note) =>
      ipcRenderer.sendSync("notes:update-sync", { id, ...note }),
    onChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("notes:changed", listener);
      return () => ipcRenderer.removeListener("notes:changed", listener);
    },
  },
};

contextBridge.exposeInMainWorld("NoteApp", api);
