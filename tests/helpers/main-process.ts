import { mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Handler = (...args: unknown[]) => unknown;

export type PreventableEvent = {
  preventDefault: () => void;
  defaultPrevented: () => boolean;
};

export type DevToolsInput = {
  type: string;
  key: string;
  control: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

export type ContextMenuParams = {
  misspelledWord: string;
  dictionarySuggestions: string[];
  editFlags: {
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
};

export type WebContentsStub = {
  listeners: Map<string, Handler>;
  openHandler: ((details: { url: string }) => { action: string }) | null;
  sentChannels: string[];
  devToolsToggleCount: number;
  replacedMisspellings: string[];
  menuTemplates: Array<Array<Record<string, unknown>>>;
  send: (channel: string) => void;
  setWindowOpenHandler: (
    handler: (details: { url: string }) => { action: string },
  ) => void;
  on: (event: string, listener: Handler) => void;
  beforeInput: (input: DevToolsInput) => boolean;
  toggleDevTools: () => void;
  willNavigate: (url: string) => boolean;
  openExternal: (url: string) => { action: string };
  replaceMisspelling: (word: string) => void;
  fireContextMenu: (params: ContextMenuParams) => void;
};

export type WindowStub = {
  options: Record<string, unknown>;
  webContents: WebContentsStub;
  onceListeners: Map<string, Handler>;
  closedListeners: Handler[];
  loadedUrls: string[];
  maximized: boolean;
  shown: boolean;
  focusCount: number;
  restoreCount: number;
  minimized: boolean;
  fire: (event: string) => void;
  setMinimized: (value: boolean) => void;
};

export type MainProcessStub = {
  ipcHandlers: Map<string, Handler>;
  ipcListeners: Map<string, Handler>;
  appListeners: Map<string, Handler>;
  windows: WindowStub[];
  externalUrls: string[];
  quitCount: number;
  userDataPath: string | null;
  databaseOpenedWith: string | null;
  databaseCloseCount: number;
  menuRemoved: boolean;
  countNotesResult: number;
  createNoteResult: unknown;
  deleteNoteResult: boolean;
  updateNoteResult: unknown;
  updateNoteThrows: boolean;
  singleInstanceLock: boolean;
  addedDictionaryWords: string[];
  replacedNoteBatches: string[][];
};

export type MainProcessHarness = {
  stub: MainProcessStub;
  whenReady: () => void;
  firstWindow: () => WindowStub;
  fireAppEvent: (event: string) => void;
  getIpcHandler: (channel: string) => Handler | undefined;
  getIpcListener: (channel: string) => Handler | undefined;
  teardown: () => void;
};

export type HarnessOptions = {
  userDataPath?: string;
  singleInstanceLock?: boolean;
};

function preventableEvent(): PreventableEvent {
  let prevented = false;

  return {
    preventDefault: () => {
      prevented = true;
    },
    defaultPrevented: () => prevented,
  };
}

/**
 * `mock.module` factories are evaluated once and then cached for the lifetime of
 * the process, so a closure over a per-test stub would keep writing into the
 * first one. A single module level `active` stub is re-pointed instead, and the
 * cached factory always reads the current value.
 */
let active: MainProcessStub | null = null;

function createWebContentsStub(): WebContentsStub {
  const target: WebContentsStub = {
    listeners: new Map(),
    openHandler: null,
    sentChannels: [],
    devToolsToggleCount: 0,
    replacedMisspellings: [],
    menuTemplates: [],
    send: (channel) => {
      target.sentChannels.push(channel);
    },
    toggleDevTools: () => {
      target.devToolsToggleCount += 1;
    },
    setWindowOpenHandler: (handler) => {
      target.openHandler = handler;
    },
    on: (event, listener) => {
      target.listeners.set(event, listener);
    },
    beforeInput: (input: DevToolsInput) => {
      const event = preventableEvent();
      target.listeners.get("before-input-event")?.(event, input);
      return event.defaultPrevented();
    },
    willNavigate: (url) => {
      const event = preventableEvent();
      target.listeners.get("will-navigate")?.(event, url);
      return event.defaultPrevented();
    },
    openExternal: (url) => {
      active?.externalUrls.push(url);
      return { action: "deny" };
    },
    replaceMisspelling: (word: string) => {
      target.replacedMisspellings.push(word);
    },
    fireContextMenu: (params: ContextMenuParams) => {
      const event = preventableEvent();
      target.listeners.get("context-menu")?.(event, params);
    },
  };

  return target;
}

class FakeBrowserWindow {
  static instances: FakeBrowserWindow[] = [];

  private readonly webContentsStub = createWebContentsStub();
  private readonly onceListeners = new Map<string, Handler>();
  private readonly closedListeners: Handler[] = [];
  private readonly loadedUrls: string[] = [];
  private self: WindowStub | null = null;

  minimized = false;

  constructor(options: Record<string, unknown>) {
    this.self = {
      options,
      webContents: this.webContentsStub,
      onceListeners: this.onceListeners,
      closedListeners: this.closedListeners,
      loadedUrls: this.loadedUrls,
      maximized: false,
      shown: false,
      focusCount: 0,
      restoreCount: 0,
      minimized: false,
      fire: (event: string) => {
        this.onceListeners.get(event)?.();
      },
      setMinimized: (value: boolean) => {
        this.minimized = value;
      },
    };

    active?.windows.push(this.self);
    FakeBrowserWindow.instances.push(this);
  }

  get webContents(): WebContentsStub {
    return this.webContentsStub;
  }

  once(event: string, listener: Handler) {
    this.onceListeners.set(event, listener);
  }

  on(event: string, listener: Handler) {
    if (event === "closed") this.closedListeners.push(listener);
  }

  maximize() {
    if (this.self !== null) this.self.maximized = true;
  }

  show() {
    if (this.self !== null) this.self.shown = true;
  }

  restore() {
    if (this.self !== null) this.self.restoreCount += 1;
  }

  focus() {
    if (this.self !== null) this.self.focusCount += 1;
  }

  isMinimized() {
    return this.minimized;
  }

  loadURL(url: string) {
    this.loadedUrls.push(url);
  }

  loadFile(file: string) {
    this.loadedUrls.push(file);
  }

  static getAllWindows(): FakeBrowserWindow[] {
    return FakeBrowserWindow.instances;
  }
}

function installMocksOnce(): void {
  mock.module("electron", () => ({
    app: {
      getPath: (name: string) => {
        if (name === "userData") return active?.userDataPath ?? "C:/userData";
        return "C:/";
      },
      setPath: (name: string, value: string) => {
        if (name === "userData" && active !== null) active.userDataPath = value;
      },
      requestSingleInstanceLock: () => active?.singleInstanceLock ?? true,
      quit: () => {
        if (active !== null) active.quitCount += 1;
      },
      whenReady: () => Promise.resolve(),
      on: (event: string, listener: Handler) => {
        active?.appListeners.set(event, listener);
      },
    },
    BrowserWindow: FakeBrowserWindow,
    Menu: {
      setApplicationMenu: () => {
        if (active !== null) active.menuRemoved = true;
      },
      buildFromTemplate: (template: Array<Record<string, unknown>>) => {
        const webContents = active?.windows[0]?.webContents;
        webContents?.menuTemplates.push(template);
        return {
          popup: () => {},
        };
      },
    },
    shell: {
      openExternal: (url: string) => {
        active?.externalUrls.push(url);
      },
    },
    ipcMain: {
      handle: (channel: string, handler: Handler) => {
        active?.ipcHandlers.set(channel, handler);
      },
      on: (channel: string, handler: Handler) => {
        active?.ipcListeners.set(channel, handler);
      },
    },
    session: {
      defaultSession: {
        setSpellCheckerEnabled: () => {},
        setSpellCheckerLanguages: () => {},
        addWordToSpellCheckerDictionary: (word: string) => {
          active?.addedDictionaryWords.push(word);
        },
      },
    },
  }));

  mock.module("../../electron/db.mjs", () => ({
    openDatabase: (userDataPath: string) => {
      if (active !== null) active.databaseOpenedWith = userDataPath;
      return {};
    },
    closeDatabase: () => {
      if (active !== null) active.databaseCloseCount += 1;
    },
    listNotes: () => [],
    countNotes: () => active?.countNotesResult ?? 0,
    createNote: () => active?.createNoteResult ?? null,
    updateNote: () => {
      if (active?.updateNoteThrows === true) {
        throw new Error("disk full");
      }
      return active?.updateNoteResult ?? null;
    },
    deleteNote: () => active?.deleteNoteResult ?? false,
    replaceAllNotes: (titles: string[]) => {
      active?.replacedNoteBatches.push(titles);
    },
  }));
}

let mocksInstalled = false;
let importCounter = 0;

export function createMainProcessHarness(
  options: HarnessOptions = {},
): MainProcessHarness {
  let userDataDir: string | null = null;

  if (options.userDataPath !== undefined) {
    userDataDir = null;
  } else {
    userDataDir = mkdtempSync(path.join(tmpdir(), "NoteApp-main-"));
  }

  const stub: MainProcessStub = {
    ipcHandlers: new Map(),
    ipcListeners: new Map(),
    appListeners: new Map(),
    windows: [],
    externalUrls: [],
    quitCount: 0,
    userDataPath: options.userDataPath ?? userDataDir,
    databaseOpenedWith: null,
    databaseCloseCount: 0,
    menuRemoved: false,
    countNotesResult: 0,
    createNoteResult: { id: 1, title: "t", body: "b" },
    deleteNoteResult: true,
    updateNoteResult: { id: 1 },
    updateNoteThrows: false,
    singleInstanceLock: options.singleInstanceLock ?? true,
    addedDictionaryWords: [],
    replacedNoteBatches: [],
  };

  active = stub;
  FakeBrowserWindow.instances = [];

  if (!mocksInstalled) {
    installMocksOnce();
    mocksInstalled = true;
  }

  return {
    stub,
    whenReady: () => {
      stub.appListeners.get("whenReady")?.();
    },
    firstWindow: () => {
      const window = stub.windows[0];
      if (window === undefined) throw new Error("no window was created");
      return window;
    },
    fireAppEvent: (event: string) => {
      stub.appListeners.get(event)?.();
    },
    getIpcHandler: (channel) => stub.ipcHandlers.get(channel),
    getIpcListener: (channel) => stub.ipcListeners.get(channel),
    teardown: () => {
      if (userDataDir !== null) {
        try {
          rmSync(userDataDir, { force: true, recursive: true });
        } catch {}
      }
      userDataDir = null;
    },
  };
}

export async function loadMainProcess(
  options: HarnessOptions = {},
): Promise<MainProcessHarness> {
  const harness = createMainProcessHarness(options);
  importCounter += 1;

  await import(`../../electron/main.mjs?case=${importCounter}`);
  await Promise.resolve();
  await Promise.resolve();

  return harness;
}
