import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import {
  closeDatabase,
  createNote,
  deleteNote,
  listNotes,
  openDatabase,
  updateNote,
} from "./db.mjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.join(dirname, "..");

const indexHtmlPath = path.join(projectRoot, "dist", "index.html");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** @type {BrowserWindow | null} */
let mainWindow = null;

const THEME_FILE = path.join(app.getPath("userData"), "theme.json");
const THEMES = ["light", "dark", "system"];

function readStoredTheme() {
  try {
    const { theme } = JSON.parse(readFileSync(THEME_FILE, "utf8"));
    return THEMES.includes(theme) ? theme : "system";
  } catch {
    return "system";
  }
}

function writeStoredTheme(theme) {
  try {
    writeFileSync(THEME_FILE, JSON.stringify({ theme }));
  } catch (error) {
    console.error("[main] could not persist theme:", error);
  }
}

ipcMain.on("theme:get", (event) => {
  event.returnValue = readStoredTheme();
});

ipcMain.on("theme:set", (_event, theme) => {
  if (THEMES.includes(theme)) writeStoredTheme(theme);
});

ipcMain.handle("notes:list", () => listNotes());

function broadcastNotesChanged() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("notes:changed");
  }
}

ipcMain.handle("notes:create", (_event, { title, body } = {}) => {
  const note = createNote(title, body);
  broadcastNotesChanged();
  return note;
});

ipcMain.handle("notes:delete", (_event, id) => {
  const deleted = deleteNote(id);
  if (deleted) broadcastNotesChanged();
  return deleted;
});

ipcMain.handle("notes:update", (_event, { id, title, body } = {}) => {
  const note = updateNote(id, title, body);
  if (note !== null) broadcastNotesChanged();
  return note;
});

ipcMain.on("notes:update-sync", (event, { id, title, body } = {}) => {
  try {
    if (updateNote(id, title, body) !== null) broadcastNotesChanged();
  } catch (error) {
    console.error("[main] could not flush note before close:", error);
  }
  event.returnValue = null;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(projectRoot, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(indexHtmlPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isDevServer =
      DEV_SERVER_URL && url.startsWith(new URL(DEV_SERVER_URL).origin);

    const isAppFile = url.split("#")[0] === pathToFileURL(indexHtmlPath).href;

    if (!isDevServer && !isAppFile) {
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    openDatabase(app.getPath("userData"));

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", closeDatabase);
