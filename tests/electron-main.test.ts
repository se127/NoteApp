import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadMainProcess,
  type DevToolsInput,
  type MainProcessHarness,
} from "./helpers/main-process";

let harness: MainProcessHarness | null = null;

afterEach(() => {
  harness?.teardown();
  harness = null;
  delete process.env["NoteApp_USER_DATA"];
  delete process.env["VITE_DEV_SERVER_URL"];
});

function themeFile(dir: string): string {
  return path.join(dir, "theme.json");
}

describe("theme persistence", () => {
  test("reports system when no theme file exists", async () => {
    harness = await loadMainProcess();
    const event = { returnValue: undefined as unknown };

    harness.getIpcListener("theme:get")?.(event);

    expect(event.returnValue).toBe("system");
  });

  test("writes a known theme to theme.json", async () => {
    harness = await loadMainProcess();
    const dir = harness.stub.userDataPath as string;

    harness.getIpcListener("theme:set")?.({}, "dark");

    expect(JSON.parse(readFileSync(themeFile(dir), "utf8"))).toEqual({
      theme: "dark",
    });
  });

  test("reads a persisted theme back", async () => {
    harness = await loadMainProcess();
    harness.getIpcListener("theme:set")?.({}, "light");

    const second = await loadMainProcess({
      userDataPath: harness.stub.userDataPath as string,
    });
    const event = { returnValue: undefined as unknown };
    second.getIpcListener("theme:get")?.(event);

    expect(event.returnValue).toBe("light");
  });

  test("refuses to persist an unknown theme", async () => {
    harness = await loadMainProcess();
    const dir = harness.stub.userDataPath as string;

    harness.getIpcListener("theme:set")?.({}, "neon");

    expect(existsSync(themeFile(dir))).toBe(false);
  });

  test("falls back to system for a corrupt theme file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "NoteApp-theme-"));
    writeFileSync(themeFile(dir), "not json at all");

    harness = await loadMainProcess({ userDataPath: dir });
    const event = { returnValue: undefined as unknown };
    harness.getIpcListener("theme:get")?.(event);

    expect(event.returnValue).toBe("system");

    rmSync(dir, { force: true, recursive: true });
  });

  test("falls back to system for an unknown stored theme", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "NoteApp-theme-"));
    writeFileSync(themeFile(dir), JSON.stringify({ theme: "neon" }));

    harness = await loadMainProcess({ userDataPath: dir });
    const event = { returnValue: undefined as unknown };
    harness.getIpcListener("theme:get")?.(event);

    expect(event.returnValue).toBe("system");

    rmSync(dir, { force: true, recursive: true });
  });
});

describe("NoteApp_USER_DATA override", () => {
  test("points the app at the overridden directory", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.userDataPath).toBe(override);
    expect(harness.stub.databaseOpenedWith).toBe(override);

    rmSync(override, { force: true, recursive: true });
  });

  test("keeps the theme file inside the overridden directory", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    const defaultDir = mkdtempSync(path.join(tmpdir(), "NoteApp-default-"));
    process.env["NoteApp_USER_DATA"] = override;

    harness = await loadMainProcess({ userDataPath: defaultDir });
    harness.getIpcListener("theme:set")?.({}, "dark");

    expect(JSON.parse(readFileSync(themeFile(override), "utf8"))).toEqual({
      theme: "dark",
    });

    rmSync(override, { force: true, recursive: true });
    rmSync(defaultDir, { force: true, recursive: true });
  });
});

describe("notes ipc", () => {
  test("registers a handler for every notes channel", async () => {
    harness = await loadMainProcess();

    expect([...harness.stub.ipcHandlers.keys()].sort()).toEqual([
      "notes:create",
      "notes:delete",
      "notes:list",
      "notes:update",
    ]);
  });

  test("lists notes", async () => {
    harness = await loadMainProcess();

    expect(harness.getIpcHandler("notes:list")?.()).toEqual([]);
  });

  test("creates a note from a title and body", async () => {
    harness = await loadMainProcess();

    expect(
      harness.getIpcHandler("notes:create")?.({}, { title: "t", body: "b" }),
    ).toEqual({ id: 1, title: "t", body: "b" });
  });

  test("creates a note with no payload without throwing", async () => {
    harness = await loadMainProcess();

    expect(() => harness?.getIpcHandler("notes:create")?.({})).not.toThrow();
  });

  test("deletes a note by id", async () => {
    harness = await loadMainProcess();

    expect(harness.getIpcHandler("notes:delete")?.({}, 3)).toBe(true);
  });

  test("updates a note and returns it", async () => {
    harness = await loadMainProcess();

    expect(
      harness.getIpcHandler("notes:update")?.(
        {},
        {
          id: 3,
          title: "t",
          body: "b",
        },
      ),
    ).toEqual({ id: 1 });
  });

  test("flushes a synchronous update on close with no reply value", async () => {
    harness = await loadMainProcess();
    const event = {} as Record<string, unknown>;

    harness.getIpcListener("notes:update-sync")?.(event, {
      id: 3,
      title: "t",
      body: "b",
    });

    expect(event).toEqual({ returnValue: null });
  });
});

describe("change broadcasts", () => {
  test("tells windows after a note is created", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.getIpcHandler("notes:create")?.({}, { title: "t", body: "b" });

    expect(harness.firstWindow().webContents.sentChannels).toContain(
      "notes:changed",
    );
  });

  test("tells windows after a note is deleted", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.getIpcHandler("notes:delete")?.({}, 1);

    expect(harness.firstWindow().webContents.sentChannels).toContain(
      "notes:changed",
    );
  });

  test("stays quiet when a delete matched no row", async () => {
    harness = await loadMainProcess();
    harness.whenReady();
    harness.stub.deleteNoteResult = false;

    harness.getIpcHandler("notes:delete")?.({}, 999);

    expect(harness.firstWindow().webContents.sentChannels).not.toContain(
      "notes:changed",
    );
  });

  test("tells windows after a note is updated", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.getIpcHandler("notes:update")?.(
      {},
      {
        id: 1,
        title: "t",
        body: "b",
      },
    );

    expect(harness.firstWindow().webContents.sentChannels).toContain(
      "notes:changed",
    );
  });

  test("stays quiet when an update matched no row", async () => {
    harness = await loadMainProcess();
    harness.whenReady();
    harness.stub.updateNoteResult = null;

    harness.getIpcHandler("notes:update")?.(
      {},
      {
        id: 1,
        title: "t",
        body: "b",
      },
    );

    expect(harness.firstWindow().webContents.sentChannels).not.toContain(
      "notes:changed",
    );
  });

  test("broadcasts nothing before a window exists", async () => {
    harness = await loadMainProcess();

    expect(() =>
      harness?.getIpcHandler("notes:create")?.({}, { title: "t", body: "b" }),
    ).not.toThrow();
  });
});

describe("window navigation guard", () => {
  test("blocks an off origin url", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(
      harness.firstWindow().webContents.willNavigate("https://evil.example"),
    ).toBe(true);
  });

  test("blocks a file url outside the app folder", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(
      harness
        .firstWindow()
        .webContents.willNavigate("file:///C:/secrets/notes.db"),
    ).toBe(true);
  });

  test("allows the packaged index html", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const loaded = harness.firstWindow().loadedUrls[0] as string;
    const appFile = pathToFileURL(loaded).href;

    expect(harness.firstWindow().webContents.willNavigate(appFile)).toBe(false);
  });

  test("allows the packaged index html with a hash route", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const loaded = harness.firstWindow().loadedUrls[0] as string;
    const withHash = `${pathToFileURL(loaded).href}#/notes/1/edit`;

    expect(harness.firstWindow().webContents.willNavigate(withHash)).toBe(
      false,
    );
  });

  test("allows the dev server origin when one is configured", async () => {
    process.env["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173";

    harness = await loadMainProcess();
    harness.whenReady();

    const window = harness.firstWindow();
    expect(window.webContents.willNavigate("http://127.0.0.1:5173/notes")).toBe(
      false,
    );
    expect(window.webContents.willNavigate("http://127.0.0.1:9999/notes")).toBe(
      true,
    );
  });
});

describe("external link handling", () => {
  test("denies every window it is asked to open", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(
      harness
        .firstWindow()
        .webContents.openHandler?.({ url: "https://example.com" }),
    ).toEqual({ action: "deny" });
  });

  test("opens a mailto url in the system browser", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const handler = harness.firstWindow().webContents.openHandler;
    handler?.({ url: "mailto:someone@example.com" });

    expect(harness.stub.externalUrls).toEqual(["mailto:someone@example.com"]);
  });

  test("opens an http url in the system browser", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const handler = harness.firstWindow().webContents.openHandler;
    handler?.({ url: "https://example.com" });

    expect(harness.stub.externalUrls).toEqual(["https://example.com"]);
  });

  test("does not open an unknown scheme", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const handler = harness.firstWindow().webContents.openHandler;
    handler?.({ url: "file:///etc/passwd" });

    expect(harness.stub.externalUrls).toEqual([]);
  });

  test("refuses to navigate the window it opens", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const handler = harness.firstWindow().webContents.openHandler;

    expect(handler?.({ url: "https://example.com" })).toEqual({
      action: "deny",
    });
    expect(handler?.({ url: "mailto:someone@example.com" })).toEqual({
      action: "deny",
    });
  });

  test("sends the opened url through the shell", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const handler = harness.firstWindow().webContents.openHandler;
    handler?.({ url: "https://example.com" });
    handler?.({ url: "https://other.example" });

    expect(harness.stub.externalUrls).toEqual([
      "https://example.com",
      "https://other.example",
    ]);
  });
});

describe("window lifecycle", () => {
  test("maximizes and shows on ready to show", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().fire("ready-to-show");

    expect(harness.firstWindow().maximized).toBe(true);
    expect(harness.firstWindow().shown).toBe(true);
  });

  test("stays hidden until ready to show fires", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.firstWindow().shown).toBe(false);
  });

  test("loads the packaged index html with no dev server", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.firstWindow().loadedUrls[0]).toContain("index.html");
  });

  test("loads the dev server url when one is configured", async () => {
    process.env["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173";

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.firstWindow().loadedUrls[0]).toBe("http://127.0.0.1:5173");
  });

  test("runs the renderer with isolation on and node off", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const webPreferences = harness.firstWindow().options[
      "webPreferences"
    ] as Record<string, unknown>;

    expect(webPreferences["contextIsolation"]).toBe(true);
    expect(webPreferences["nodeIntegration"]).toBe(false);
    expect(webPreferences["sandbox"]).toBe(true);
  });

  test("removes the application menu", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.menuRemoved).toBe(true);
  });

  test("does not open dev tools on its own", async () => {
    process.env["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173";

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("opens the database at the user data path", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.databaseOpenedWith).toBe(harness.stub.userDataPath);
  });

  test("closes the database on quit", async () => {
    harness = await loadMainProcess();

    harness.fireAppEvent("will-quit");

    expect(harness.stub.databaseCloseCount).toBe(1);
  });

  test("quits when the last window closes", async () => {
    harness = await loadMainProcess();

    harness.fireAppEvent("window-all-closed");

    expect(harness.stub.quitCount).toBe(1);
  });

  test("focuses the window on a second instance", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.fireAppEvent("second-instance");

    expect(harness.firstWindow().focusCount).toBe(1);
  });

  test("restores a minimised window on a second instance", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const window = harness.firstWindow();
    window.setMinimized(true);

    harness.fireAppEvent("second-instance");

    expect(window.restoreCount).toBe(1);
    expect(window.focusCount).toBe(1);
  });

  test("does not restore a window that is not minimised", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const window = harness.firstWindow();
    window.setMinimized(false);

    harness.fireAppEvent("second-instance");

    expect(window.restoreCount).toBe(0);
    expect(window.focusCount).toBe(1);
  });
});

describe("dev tools shortcut", () => {
  function devToolsKey(overrides: Partial<DevToolsInput> = {}): DevToolsInput {
    return {
      type: "keyDown",
      key: "i",
      control: true,
      shift: true,
      alt: false,
      meta: false,
      ...overrides,
    };
  }

  async function readyWithDevServer(): Promise<MainProcessHarness> {
    process.env["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173";
    const loaded = await loadMainProcess();
    loaded.whenReady();
    return loaded;
  }

  test("toggles dev tools on ctrl+shift+i", async () => {
    harness = await readyWithDevServer();

    const prevented = harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey());

    expect(prevented).toBe(true);
    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(1);
  });

  test("toggles dev tools on a capital i", async () => {
    harness = await readyWithDevServer();

    harness.firstWindow().webContents.beforeInput(devToolsKey({ key: "I" }));

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(1);
  });

  test("ignores the meta variant so ctrl+shift+i stays the only chord", async () => {
    harness = await readyWithDevServer();

    const prevented = harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey({ control: false, meta: true }));

    expect(prevented).toBe(false);
    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("ignores the key on key up so one press toggles once", async () => {
    harness = await readyWithDevServer();

    const prevented = harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey({ type: "keyUp" }));

    expect(prevented).toBe(false);
    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("ignores the key without shift", async () => {
    harness = await readyWithDevServer();

    harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey({ shift: false }));

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("ignores the key with alt held", async () => {
    harness = await readyWithDevServer();

    harness.firstWindow().webContents.beforeInput(devToolsKey({ alt: true }));

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("ignores a bare i", async () => {
    harness = await readyWithDevServer();

    harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey({ control: false, shift: false }));

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("ignores another letter", async () => {
    harness = await readyWithDevServer();

    harness.firstWindow().webContents.beforeInput(devToolsKey({ key: "j" }));

    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });

  test("is not wired up outside the dev server", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const prevented = harness
      .firstWindow()
      .webContents.beforeInput(devToolsKey());

    expect(prevented).toBe(false);
    expect(harness.firstWindow().webContents.devToolsToggleCount).toBe(0);
  });
});

describe("single instance lock", () => {
  test("quits without a window when another instance holds the lock", async () => {
    harness = await loadMainProcess({ singleInstanceLock: false });

    expect(harness.stub.quitCount).toBe(1);
    expect(harness.stub.windows).toHaveLength(0);
    expect(harness.stub.databaseOpenedWith).toBeNull();
  });

  test("opens a window when the lock is free", async () => {
    harness = await loadMainProcess({ singleInstanceLock: true });
    harness.whenReady();

    expect(harness.stub.quitCount).toBe(0);
    expect(harness.stub.windows).toHaveLength(1);
  });
});
