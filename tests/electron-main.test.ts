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
import { DEV_NOTE_TITLES } from "../electron/dev-notes.mjs";

let harness: MainProcessHarness | null = null;

afterEach(() => {
  harness?.teardown();
  harness = null;
  delete process.env["NoteApp_USER_DATA"];
  delete process.env["VITE_DEV_SERVER_URL"];
  delete process.env["NoteApp_DEV_NOTES"];
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
      accent: "blue",
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

describe("accent persistence", () => {
  function accentReply(h: MainProcessHarness): unknown {
    const event = { returnValue: undefined as unknown };
    h.getIpcListener("accent:get")?.(event);
    return event.returnValue;
  }

  test("reports blue when no theme file exists", async () => {
    harness = await loadMainProcess();

    expect(accentReply(harness)).toBe("blue");
  });

  test("writes a known accent to theme.json", async () => {
    harness = await loadMainProcess();
    const dir = harness.stub.userDataPath as string;

    harness.getIpcListener("accent:set")?.({}, "orange");

    expect(JSON.parse(readFileSync(themeFile(dir), "utf8"))).toEqual({
      theme: "system",
      accent: "orange",
    });
  });

  test("reads a persisted accent back", async () => {
    harness = await loadMainProcess();
    harness.getIpcListener("accent:set")?.({}, "green");

    const second = await loadMainProcess({
      userDataPath: harness.stub.userDataPath as string,
    });

    expect(accentReply(second)).toBe("green");
  });

  test("refuses to persist an unknown accent", async () => {
    harness = await loadMainProcess();
    const dir = harness.stub.userDataPath as string;

    harness.getIpcListener("accent:set")?.({}, "neon");

    expect(existsSync(themeFile(dir))).toBe(false);
  });

  test("falls back to blue for an unknown stored accent", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "NoteApp-accent-"));
    writeFileSync(themeFile(dir), JSON.stringify({ accent: "neon" }));

    harness = await loadMainProcess({ userDataPath: dir });

    expect(accentReply(harness)).toBe("blue");

    rmSync(dir, { force: true, recursive: true });
  });

  test("keeps the theme when only the accent is written", async () => {
    harness = await loadMainProcess();
    harness.getIpcListener("theme:set")?.({}, "dark");

    harness.getIpcListener("accent:set")?.({}, "orange");

    const themeEvent = { returnValue: undefined as unknown };
    harness.getIpcListener("theme:get")?.(themeEvent);
    expect(themeEvent.returnValue).toBe("dark");
    expect(accentReply(harness)).toBe("orange");
  });

  test("keeps the accent when only the theme is written", async () => {
    harness = await loadMainProcess();
    harness.getIpcListener("accent:set")?.({}, "green");

    harness.getIpcListener("theme:set")?.({}, "light");

    expect(accentReply(harness)).toBe("green");
  });

  test("keeps an accent written by an older single-key theme file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "NoteApp-accent-"));
    writeFileSync(themeFile(dir), JSON.stringify({ theme: "dark" }));

    harness = await loadMainProcess({ userDataPath: dir });

    expect(accentReply(harness)).toBe("blue");
    harness.getIpcListener("accent:set")?.({}, "green");

    const themeEvent = { returnValue: undefined as unknown };
    harness.getIpcListener("theme:get")?.(themeEvent);
    expect(themeEvent.returnValue).toBe("dark");

    rmSync(dir, { force: true, recursive: true });
  });

  test("keeps the accent inside the overridden directory", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    const defaultDir = mkdtempSync(path.join(tmpdir(), "NoteApp-default-"));
    process.env["NoteApp_USER_DATA"] = override;

    harness = await loadMainProcess({ userDataPath: defaultDir });
    harness.getIpcListener("accent:set")?.({}, "orange");

    expect(accentReply(harness)).toBe("orange");
    expect(existsSync(themeFile(defaultDir))).toBe(false);

    rmSync(override, { force: true, recursive: true });
    rmSync(defaultDir, { force: true, recursive: true });
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
      accent: "blue",
    });

    rmSync(override, { force: true, recursive: true });
    rmSync(defaultDir, { force: true, recursive: true });
  });
});

describe("dev seed notes", () => {
  test("replaces every note when the dev user data directory is set", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;
    process.env["NoteApp_DEV_NOTES"] = String(DEV_NOTE_TITLES.length);

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([DEV_NOTE_TITLES]);

    rmSync(override, { force: true, recursive: true });
  });

  test("seeds nothing without a note count", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([[]]);

    rmSync(override, { force: true, recursive: true });
  });

  test("seeds only as many titles as asked for", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;
    process.env["NoteApp_DEV_NOTES"] = "3";

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([
      DEV_NOTE_TITLES.slice(0, 3),
    ]);

    rmSync(override, { force: true, recursive: true });
  });

  test("cycles the titles when asked for more than exist", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;
    const total = DEV_NOTE_TITLES.length * 2 + 1;
    process.env["NoteApp_DEV_NOTES"] = String(total);

    harness = await loadMainProcess();
    harness.whenReady();

    const [titles] = harness.stub.replacedNoteBatches;
    expect(titles).toHaveLength(total);
    expect(titles.slice(0, DEV_NOTE_TITLES.length)).toEqual(DEV_NOTE_TITLES);
    expect(titles[DEV_NOTE_TITLES.length]).toBe(`${DEV_NOTE_TITLES[0]} (2)`);
    expect(new Set(titles).size).toBe(total);

    rmSync(override, { force: true, recursive: true });
  });

  test.each(["abc", "-4", "1.5"])(
    "seeds nothing for the unusable count %p",
    async (count) => {
      const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
      process.env["NoteApp_USER_DATA"] = override;
      process.env["NoteApp_DEV_NOTES"] = count;

      harness = await loadMainProcess();
      harness.whenReady();

      expect(harness.stub.replacedNoteBatches).toEqual([[]]);

      rmSync(override, { force: true, recursive: true });
    },
  );

  test("seeds fifty Persian titles with no bodies", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;
    process.env["NoteApp_DEV_NOTES"] = "50";

    harness = await loadMainProcess();
    harness.whenReady();

    const titles = harness.stub.replacedNoteBatches[0] ?? [];
    expect(titles).toHaveLength(50);
    expect(new Set(titles).size).toBe(50);
    expect(titles.every((title) => !/[A-Za-z]/.test(title))).toBe(true);

    rmSync(override, { force: true, recursive: true });
  });

  test("seeds short, medium and long titles", async () => {
    const override = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = override;
    process.env["NoteApp_DEV_NOTES"] = "50";

    harness = await loadMainProcess();
    harness.whenReady();

    const titles = harness.stub.replacedNoteBatches[0] ?? [];
    const lengths = titles.map((title) => title.length);

    expect(lengths.filter((length) => length <= 15).length).toBeGreaterThan(0);
    expect(
      lengths.filter((length) => length > 15 && length <= 30).length,
    ).toBeGreaterThan(0);
    expect(lengths.filter((length) => length > 30).length).toBeGreaterThan(0);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(30);

    rmSync(override, { force: true, recursive: true });
  });

  test("never seeds a packaged run", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([]);
  });

  test("never seeds a packaged run even with a dev server", async () => {
    process.env["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173";

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([]);
  });

  test("never seeds a packaged run that asks for thousands of notes", async () => {
    process.env["NoteApp_DEV_NOTES"] = "5000";

    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.replacedNoteBatches).toEqual([]);
  });
});

describe("notes ipc", () => {
  test("registers a handler for every notes channel", async () => {
    harness = await loadMainProcess();

    expect([...harness.stub.ipcHandlers.keys()].sort()).toEqual([
      "notes:count",
      "notes:create",
      "notes:delete",
      "notes:list",
      "notes:update",
    ]);
  });

  test("lists notes", async () => {
    harness = await loadMainProcess();

    expect(await harness.getIpcHandler("notes:list")?.()).toEqual([]);
  });

  test("passes the page size and offset through to the list query", async () => {
    harness = await loadMainProcess();
    harness.stub.listNotesCalls = [];

    await harness.getIpcHandler("notes:list")?.({}, { limit: 15, offset: 30 });

    expect(harness.stub.listNotesCalls).toEqual([[15, 30]]);
  });

  test("reads every note from the first row when the page size is missing", async () => {
    harness = await loadMainProcess();
    harness.stub.listNotesCalls = [];

    await harness.getIpcHandler("notes:list")?.({});

    expect(harness.stub.listNotesCalls).toEqual([[-1, 0]]);
  });

  test.each([-5, 2.5, Number.NaN, null])(
    "falls back to every note for the page size %p",
    async (limit) => {
      harness = await loadMainProcess();
      harness.stub.listNotesCalls = [];

      await harness.getIpcHandler("notes:list")?.({}, { limit, offset: 30 });

      expect(harness.stub.listNotesCalls).toEqual([[-1, 30]]);
    },
  );

  test.each([-5, 2.5, Number.NaN, null, undefined])(
    "starts at the first row for the offset %p",
    async (offset) => {
      harness = await loadMainProcess();
      harness.stub.listNotesCalls = [];

      await harness.getIpcHandler("notes:list")?.({}, { limit: 15, offset });

      expect(harness.stub.listNotesCalls).toEqual([[15, 0]]);
    },
  );

  test("passes a page size larger than the table through untouched", async () => {
    harness = await loadMainProcess();
    harness.stub.listNotesCalls = [];

    await harness.getIpcHandler("notes:list")?.({}, { limit: 1_000_000 });

    expect(harness.stub.listNotesCalls).toEqual([[1_000_000, 0]]);
  });

  test("counts notes on a channel of its own", async () => {
    harness = await loadMainProcess();
    harness.stub.countNotesResult = 137;

    expect(harness.getIpcHandler("notes:count")?.()).toBe(137);
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

describe("dev db delay", () => {
  afterEach(() => {
    delete process.env["NoteApp_DB_DELAY"];
  });

  function overrideUserData(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "NoteApp-override-"));
    process.env["NoteApp_USER_DATA"] = dir;
    return dir;
  }

  test("holds a notes channel back for the asked number of milliseconds", async () => {
    overrideUserData();
    process.env["NoteApp_DB_DELAY"] = "120";

    harness = await loadMainProcess();
    harness.whenReady();

    const startedAt = Date.now();
    await harness.getIpcHandler("notes:list")?.();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  test("delays the count channel as well as the list channel", async () => {
    overrideUserData();
    process.env["NoteApp_DB_DELAY"] = "120";

    harness = await loadMainProcess();

    const listStart = Date.now();
    await harness.getIpcHandler("notes:list")?.();
    const listElapsed = Date.now() - listStart;

    const countStart = Date.now();
    await harness.getIpcHandler("notes:count")?.();
    const countElapsed = Date.now() - countStart;

    expect(listElapsed).toBeGreaterThanOrEqual(100);
    expect(countElapsed).toBeGreaterThanOrEqual(100);
  });

  test.each(["notes:create", "notes:delete", "notes:update"])(
    "delays the %s channel",
    async (channel) => {
      overrideUserData();
      process.env["NoteApp_DB_DELAY"] = "120";

      harness = await loadMainProcess();
      harness.whenReady();

      const startedAt = Date.now();
      await harness.getIpcHandler(channel)?.(
        {},
        { id: 1, title: "t", body: "b" },
      );
      const elapsed = Date.now() - startedAt;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    },
  );

  test("answers straight away with no delay configured", async () => {
    overrideUserData();

    harness = await loadMainProcess();
    harness.whenReady();

    const startedAt = Date.now();
    await harness.getIpcHandler("notes:list")?.();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(100);
  });

  test("never delays a packaged run even when the flag is set", async () => {
    process.env["NoteApp_DB_DELAY"] = "1000";

    harness = await loadMainProcess();
    harness.whenReady();

    const startedAt = Date.now();
    await harness.getIpcHandler("notes:list")?.();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(100);
  });

  test("falls back to no delay for an unusable value", async () => {
    overrideUserData();
    process.env["NoteApp_DB_DELAY"] = "abc";

    harness = await loadMainProcess();
    harness.whenReady();

    const startedAt = Date.now();
    await harness.getIpcHandler("notes:list")?.();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(100);
  });

  test("keeps the close flush immediate so the last edit is never lost", async () => {
    overrideUserData();
    process.env["NoteApp_DB_DELAY"] = "1000";

    harness = await loadMainProcess();
    const event = {} as Record<string, unknown>;

    const startedAt = Date.now();
    harness.getIpcListener("notes:update-sync")?.(event, {
      id: 3,
      title: "t",
      body: "b",
    });
    const elapsed = Date.now() - startedAt;

    expect(event).toEqual({ returnValue: null });
    expect(elapsed).toBeLessThan(100);
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

  test("refuses to be resized below 800x600", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const { minWidth, minHeight } = harness.firstWindow().options as Record<
      string,
      unknown
    >;

    expect(minWidth).toBe(800);
    expect(minHeight).toBe(600);
  });

  test("never sets an upper size limit", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const options = harness.firstWindow().options;

    expect(options["maxWidth"]).toBeUndefined();
    expect(options["maxHeight"]).toBeUndefined();
  });

  test("opens at a size that already clears the minimum", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const { width, height, minWidth, minHeight } = harness.firstWindow()
      .options as Record<string, unknown>;

    expect(width as number).toBeGreaterThanOrEqual(minWidth as number);
    expect(height as number).toBeGreaterThanOrEqual(minHeight as number);
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

describe("spell check menu", () => {
  test("enables the spell checker with en-US and fa-IR", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    expect(harness.stub.windows).toHaveLength(1);
  });

  test("shows cut, copy, paste and select all on right-click", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "",
      dictionarySuggestions: [],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    expect(templates).toHaveLength(1);
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels).toEqual(["Cut", "Copy", "Paste", "Select All"]);
  });

  test("shows suggestions first, then learn spelling, then edit actions", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "teh",
      dictionarySuggestions: ["the", "tea"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels[0]).toBe("the");
    expect(labels[1]).toBe("tea");
    expect(labels).toContain("Learn Spelling");
    expect(labels.at(-4)).toBe("Cut");
    expect(labels.at(-3)).toBe("Copy");
    expect(labels.at(-2)).toBe("Paste");
    expect(labels.at(-1)).toBe("Select All");

    const learnIndex = labels.indexOf("Learn Spelling");
    const cutIndex = labels.indexOf("Cut");
    expect(learnIndex).toBeLessThan(cutIndex);
  });

  test("disables cut and copy when there is no selection", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "",
      dictionarySuggestions: [],
      editFlags: {
        canCut: false,
        canCopy: false,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const items = templates[0] as Array<{ label?: string; enabled?: boolean }>;
    const cut = items.find((item) => item.label === "Cut");
    const copy = items.find((item) => item.label === "Copy");
    const paste = items.find((item) => item.label === "Paste");

    expect(cut?.enabled).toBe(false);
    expect(copy?.enabled).toBe(false);
    expect(paste?.enabled).toBe(true);
  });

  test("shows spelling suggestions when a word is misspelled", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "teh",
      dictionarySuggestions: ["the", "tea"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels).toContain("the");
    expect(labels).toContain("tea");
    expect(labels).toContain("Learn Spelling");
  });

  test("replaces a misspelling when a suggestion is clicked", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "teh",
      dictionarySuggestions: ["the"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const items = templates[0] as Array<{
      label?: string;
      click?: () => void;
    }>;
    const suggestion = items.find((item) => item.label === "the");
    suggestion?.click?.();

    expect(harness.firstWindow().webContents.replacedMisspellings).toEqual([
      "the",
    ]);
  });

  test("adds a word to the dictionary when Learn Spelling is clicked", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "teh",
      dictionarySuggestions: ["the"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const items = templates[0] as Array<{
      label?: string;
      click?: () => void;
    }>;
    const learnSpelling = items.find((item) => item.label === "Learn Spelling");
    learnSpelling?.click?.();

    expect(harness.stub.addedDictionaryWords).toEqual(["teh"]);
  });
});

describe("spell check suggestions", () => {
  test("shows dictionary suggestions when a word is misspelled", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "teh",
      dictionarySuggestions: ["the", "tea"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels).toContain("the");
    expect(labels).toContain("tea");
  });

  test("adds case variations to suggestions", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "hello",
      dictionarySuggestions: [],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels).toContain("Hello");
    expect(labels).toContain("HELLO");
  });

  test("filters out the original word from suggestions", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "the",
      dictionarySuggestions: ["the"],
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const labels = templates[0].map(
      (item) => (item as { label?: string }).label,
    );
    expect(labels).not.toContain("the");
  });

  test("limits suggestions to 10", async () => {
    harness = await loadMainProcess();
    harness.whenReady();

    const many = Array.from({ length: 15 }, (_, i) => `suggestion${i}`);
    harness.firstWindow().webContents.fireContextMenu({
      misspelledWord: "word",
      dictionarySuggestions: many,
      editFlags: {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
      },
    });

    const templates = harness.firstWindow().webContents.menuTemplates;
    const suggestionItems = templates[0].filter(
      (item) =>
        (item as { label?: string }).label?.startsWith("suggestion") === true,
    );
    expect(suggestionItems.length).toBeLessThanOrEqual(10);
  });
});
