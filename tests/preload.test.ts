import { describe, expect, test } from "bun:test";

import { loadPreload } from "./helpers/load-preload";

describe("preload bridge", () => {
  test("exposes the bridge under the NoteApp key", () => {
    const preload = loadPreload();

    expect(preload.exposedKey).toBe("NoteApp");
    expect(preload.bridge).toBeDefined();
  });

  test("exposes only the theme and notes namespaces", () => {
    const preload = loadPreload();

    expect(Object.keys(preload.bridge).sort()).toEqual(["notes", "theme"]);
  });

  test("exposes the note methods the renderer relies on", () => {
    const preload = loadPreload();

    expect(Object.keys(preload.bridge.notes).sort()).toEqual([
      "count",
      "create",
      "list",
      "onChanged",
      "remove",
      "removeMany",
      "update",
      "updateSync",
    ]);
  });

  test("exposes the theme methods the renderer relies on", () => {
    const preload = loadPreload();

    expect(Object.keys(preload.bridge.theme).sort()).toEqual([
      "accent",
      "get",
      "set",
    ]);
  });

  test("exposes the accent methods the renderer relies on", () => {
    const preload = loadPreload();

    expect(Object.keys(preload.bridge.theme.accent).sort()).toEqual([
      "get",
      "set",
    ]);
  });

  test("reads the theme over a synchronous channel", () => {
    const preload = loadPreload();
    preload.setSyncReply("dark");

    expect(preload.bridge.theme.get()).toBe("dark");
    expect(preload.syncCalls.at(-1)).toEqual({
      channel: "theme:get",
      args: [],
    });
  });

  test("writes the theme over the asynchronous channel", () => {
    const preload = loadPreload();

    preload.bridge.theme.set("light");

    expect(preload.sendCalls.at(-1)).toEqual({
      channel: "theme:set",
      args: ["light"],
    });
  });

  test("reads the accent over a synchronous channel", () => {
    const preload = loadPreload();
    preload.setSyncReply("orange");

    expect(preload.bridge.theme.accent.get()).toBe("orange");
    expect(preload.syncCalls.at(-1)).toEqual({
      channel: "accent:get",
      args: [],
    });
  });

  test("writes the accent over the asynchronous channel", () => {
    const preload = loadPreload();

    preload.bridge.theme.accent.set("green");

    expect(preload.sendCalls.at(-1)).toEqual({
      channel: "accent:set",
      args: ["green"],
    });
  });

  test("lists notes over invoke", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.list();

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:list",
      args: [{ limit: undefined, offset: 0 }],
    });
  });

  test("passes the page size and offset to the list channel", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.list(15, 30);

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:list",
      args: [{ limit: 15, offset: 30 }],
    });
  });

  test("starts every page at the first row when no offset is given", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.list(15);

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:list",
      args: [{ limit: 15, offset: 0 }],
    });
  });

  test("counts notes over its own channel", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.count();

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:count",
      args: [],
    });
    expect(
      preload.invokeCalls.some((call) => call.channel === "notes:list"),
    ).toBe(false);
  });

  test("creates a note with title and body", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.create({ title: "t", body: "b" });

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:create",
      args: [{ title: "t", body: "b" }],
    });
  });

  test("deletes a note by id", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.remove(7);

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:delete",
      args: [7],
    });
  });

  test("deletes a whole selection over one channel", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.removeMany([1, 2, 3]);

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:delete-many",
      args: [[1, 2, 3]],
    });
  });

  test("merges the id into the update payload", async () => {
    const preload = loadPreload();

    await preload.bridge.notes.update(3, { title: "t", body: "b" });

    expect(preload.invokeCalls.at(-1)).toEqual({
      channel: "notes:update",
      args: [{ id: 3, title: "t", body: "b" }],
    });
  });

  test("sends a synchronous update and returns the reply", () => {
    const preload = loadPreload();
    preload.setSyncReply(null);

    expect(
      preload.bridge.notes.updateSync(3, { title: "t", body: "b" }),
    ).toBeNull();
    expect(preload.syncCalls.at(-1)).toEqual({
      channel: "notes:update-sync",
      args: [{ id: 3, title: "t", body: "b" }],
    });
  });

  test("subscribes to change broadcasts", () => {
    const preload = loadPreload();
    const received: number[] = [];

    preload.bridge.notes.onChanged(() => received.push(1));
    for (const listener of preload.listeners.get("notes:changed") ?? [])
      listener();

    expect(received).toHaveLength(1);
  });

  test("unsubscribes from change broadcasts", () => {
    const preload = loadPreload();
    const received: number[] = [];

    const unsubscribe = preload.bridge.notes.onChanged(() => received.push(1));
    unsubscribe();
    for (const listener of preload.listeners.get("notes:changed") ?? [])
      listener();

    expect(received).toHaveLength(0);
  });

  test("supports several subscribers at once", () => {
    const preload = loadPreload();
    const received: string[] = [];

    preload.bridge.notes.onChanged(() => received.push("first"));
    preload.bridge.notes.onChanged(() => received.push("second"));
    for (const listener of preload.listeners.get("notes:changed") ?? [])
      listener();

    expect(received).toEqual(["first", "second"]);
  });

  test("does not require anything but electron", () => {
    const preload = loadPreload();

    expect(preload.exposedKey).toBe("NoteApp");
  });
});
