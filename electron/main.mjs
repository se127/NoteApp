import { app, BrowserWindow, ipcMain, Menu, shell, session } from "electron";
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

const OVERRIDE_USER_DATA = process.env["NoteApp_USER_DATA"];

if (OVERRIDE_USER_DATA !== undefined) {
  app.setPath("userData", OVERRIDE_USER_DATA);
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

const THEME_FILE = path.join(app.getPath("userData"), "theme.json");
const THEMES = ["light", "dark", "system"];
const ACCENTS = ["blue", "green", "orange"];
const DEFAULT_APPEARANCE = { theme: "system", accent: "blue" };

function readStoredAppearance() {
  try {
    const stored = JSON.parse(readFileSync(THEME_FILE, "utf8"));
    return {
      theme: THEMES.includes(stored.theme)
        ? stored.theme
        : DEFAULT_APPEARANCE.theme,
      accent: ACCENTS.includes(stored.accent)
        ? stored.accent
        : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function writeStoredAppearance(patch) {
  try {
    writeFileSync(
      THEME_FILE,
      JSON.stringify({ ...readStoredAppearance(), ...patch }),
    );
  } catch (error) {
    console.error("[main] could not persist theme:", error);
  }
}

ipcMain.on("theme:get", (event) => {
  event.returnValue = readStoredAppearance().theme;
});

ipcMain.on("theme:set", (_event, theme) => {
  if (THEMES.includes(theme)) writeStoredAppearance({ theme });
});

ipcMain.on("accent:get", (event) => {
  event.returnValue = readStoredAppearance().accent;
});

ipcMain.on("accent:set", (_event, accent) => {
  if (ACCENTS.includes(accent)) writeStoredAppearance({ accent });
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

const SPELL_CHECK_LANGUAGES = ["en-US", "fa-IR"];
const MAX_SUGGESTIONS = 10;

export function buildSmartSuggestions(word, dictionarySuggestions) {
  const suggestions = new Set(dictionarySuggestions);

  if (word.length > 1) {
    suggestions.add(word.charAt(0).toUpperCase() + word.slice(1));
    suggestions.add(word.toUpperCase());
    suggestions.add(word.toLowerCase());
  }

  const deduplicated = word.replace(/(.)\1{2,}/g, "$1$1");
  if (deduplicated !== word) suggestions.add(deduplicated);

  return [...suggestions].filter((s) => s !== word).slice(0, MAX_SUGGESTIONS);
}

function setupSpellCheckMenu(window) {
  const defaultSession = session.defaultSession;
  defaultSession.setSpellCheckerEnabled(true);
  defaultSession.setSpellCheckerLanguages(SPELL_CHECK_LANGUAGES);

  window.webContents.on("context-menu", (event, params) => {
    const { misspelledWord, dictionarySuggestions } = params;

    const { editFlags } = params;
    const template = [];

    if (misspelledWord !== "") {
      const suggestions = buildSmartSuggestions(
        misspelledWord,
        dictionarySuggestions,
      );

      for (const suggestion of suggestions) {
        template.push({
          label: suggestion,
          click: () => {
            window.webContents.replaceMisspelling(suggestion);
          },
        });
      }

      template.push({ type: "separator" });
      template.push({
        label: "Learn Spelling",
        click: () => {
          session.defaultSession.addWordToSpellCheckerDictionary(
            misspelledWord,
          );
        },
      });
      template.push({ type: "separator" });
    }

    template.push(
      { role: "cut", label: "Cut", accelerator: "", enabled: editFlags.canCut },
      {
        role: "copy",
        label: "Copy",
        accelerator: "",
        enabled: editFlags.canCopy,
      },
      {
        role: "paste",
        label: "Paste",
        accelerator: "",
        enabled: editFlags.canPaste,
      },
      {
        role: "selectAll",
        label: "Select All",
        accelerator: "",
        enabled: editFlags.canSelectAll,
      },
    );

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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

  if (DEV_SERVER_URL) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      const isToggleDevTools =
        input.type === "keyDown" &&
        input.key.toLowerCase() === "i" &&
        input.control &&
        input.shift &&
        !input.alt &&
        !input.meta;

      if (!isToggleDevTools) return;

      event.preventDefault();
      mainWindow?.webContents.toggleDevTools();
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  setupSpellCheckMenu(mainWindow);

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
  console.error(
    "[main] another instance is already running; quitting without a window",
  );
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
