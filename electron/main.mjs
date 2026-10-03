/**
 * Electron main process.
 *
 * Plain JavaScript (ESM) on purpose: no bundler or compile step is needed for
 * the main/preload pair, which keeps `bun run dev` fast and avoids a second
 * build pipeline next to Vite.
 *
 * In development it loads the Vite dev server over HTTP. It expects
 * VITE_DEV_SERVER_URL to be set by the dev script once the server is up.
 */
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

/** Root of the repo, used to resolve the preload script and the built index.html. */
const projectRoot = path.join(dirname, "..");

/** The renderer entry point, loaded over http in dev and file:// when packaged. */
const indexHtmlPath = path.join(projectRoot, "dist", "index.html");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** @type {BrowserWindow | null} */
let mainWindow = null;

/*
 * Theme persistence.
 *
 * Stored as JSON in the app's userData directory rather than in the renderer's
 * localStorage: localStorage is scoped to an origin, and the renderer runs on
 * http://127.0.0.1:5173 in development but file:// in a packaged build, so
 * localStorage would silently lose the choice when the two are mixed.
 */
const THEME_FILE = path.join(app.getPath("userData"), "theme.json");
const THEMES = ["light", "dark", "system"];

function readStoredTheme() {
  try {
    const { theme } = JSON.parse(readFileSync(THEME_FILE, "utf8"));
    return THEMES.includes(theme) ? theme : "system";
  } catch {
    // No file yet, or it is corrupt: fall back to following the OS.
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

/*
 * Notes.
 *
 * handle (not on) so the renderer gets a promise and errors propagate instead
 * of being silently dropped.
 */
ipcMain.handle("notes:list", () => listNotes());

/** Tell every window to refetch, so the list stays consistent. */
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
  // null when the row is gone, e.g. the note was deleted in another window.
  const note = updateNote(id, title, body);
  if (note !== null) broadcastNotesChanged();
  return note;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#ffffff",
    // Hide the in-window menu bar. Menu.setApplicationMenu(null) below also
    // removes it from the global menu (the macOS app menu and the Alt-revealed
    // bar on Windows/Linux).
    autoHideMenuBar: true,
    webPreferences: {
      // Must be CommonJS: a sandboxed preload cannot be ESM.
      preload: path.join(projectRoot, "electron", "preload.cjs"),
      // The renderer is untrusted: keep Node integration off and expose only
      // what preload deliberately bridges.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Avoid the white flash before React paints.
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(indexHtmlPath);
  }

  // Open external links (http/https/mailto) in the user's browser instead of
  // navigating the app window away from the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Block in-app navigation to anything that is not the app itself.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isDevServer =
      DEV_SERVER_URL && url.startsWith(new URL(DEV_SERVER_URL).origin);

    /*
     * Compare against pathToFileURL, not a `file://${path}` template. On
     * Windows the path carries backslashes and a drive letter while the URL
     * uses forward slashes and a leading slash, so the two never compared
     * equal and this blocked the app's own page. The hash is dropped because
     * HashRouter appends one, e.g. index.html#/notes/new.
     */
    const isAppFile = url.split("#")[0] === pathToFileURL(indexHtmlPath).href;

    if (!isDevServer && !isAppFile) {
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// A second instance would fight over the same window, so focus the first one.
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
    // Drop the default File/Edit/View/Window/Help bar entirely. Do this before
    // creating the window so no menu is ever attached to it.
    Menu.setApplicationMenu(null);

    openDatabase(app.getPath("userData"));

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// macOS convention: keep the app alive in the dock with no windows open.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Flush WAL and release the handle on quit.
app.on("will-quit", closeDatabase);
