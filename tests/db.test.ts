import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createTestDatabase,
  isRealUserDataPath,
  type TestDatabase,
} from "./helpers/test-database";

let database: TestDatabase;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.dispose();
});

describe("test database isolation", () => {
  test("never opens a database inside a real user data directory", () => {
    expect(isRealUserDataPath(database.userDataPath)).toBe(false);
  });

  test("writes its files under the system temporary directory", () => {
    expect(database.userDataPath.startsWith(path.resolve(tmpdir()))).toBe(true);
  });

  test("gives every test its own directory", () => {
    const first = createTestDatabase().userDataPath;
    const second = createTestDatabase().userDataPath;

    expect(first).not.toBe(second);
  });

  test("never creates notes.db inside a real user data directory", () => {
    const appData = process.env["APPDATA"];
    if (appData === undefined) return;

    for (const name of ["NoteApp", "NoteApp-dev"]) {
      expect(existsSync(path.join(appData, name, "case-"))).toBe(false);
    }
  });

  test("starts empty and does not see the app database", () => {
    expect(database.list()).toEqual([]);
  });
});

describe("createNote", () => {
  test("returns the stored note with generated timestamps", () => {
    const note = database.create("سفارش خرید", "نان و پنیر");

    expect(note.id).toBeGreaterThan(0);
    expect(note.title).toBe("سفارش خرید");
    expect(note.body).toBe("نان و پنیر");
    expect(note.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(note.updatedAt).toBe(note.createdAt);
  });

  test("keeps an empty title and body", () => {
    const note = database.create("", "");

    expect(database.list()).toEqual([note]);
  });

  test("assigns increasing ids", () => {
    const first = database.create("یک", "");
    const second = database.create("دو", "");

    expect(second.id).toBeGreaterThan(first.id);
  });
});

describe("listNotes", () => {
  test("returns newest first for notes created in the same second", () => {
    const first = database.create("اول", "");
    const second = database.create("دوم", "");
    const third = database.create("سوم", "");

    expect(database.list().map((note) => note.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });
});

describe("updateNote", () => {
  test("updates the note and advances updatedAt", async () => {
    const note = database.create("قدیمی", "متن قدیمی");

    await Bun.sleep(1100);

    const updated = database.update(note.id, "جدید", "متن جدید");

    expect(updated?.title).toBe("جدید");
    expect(updated?.body).toBe("متن جدید");
    expect(updated?.createdAt).toBe(note.createdAt);
    expect(updated?.updatedAt === note.updatedAt).toBe(false);
  });

  test("returns null for an unknown id", () => {
    expect(database.update(9999, "x", "y")).toBeNull();
  });

  test.each([0, -1, 1.5, Number.NaN])("rejects the id %p", (id) => {
    expect(() => database.update(id, "x", "y")).toThrow(
      "شناسه یادداشت نامعتبر است",
    );
  });
});

describe("deleteNote", () => {
  test("removes the note and reports success", () => {
    const note = database.create("حذف‌شونده", "");

    expect(database.remove(note.id)).toBe(true);
    expect(database.list()).toEqual([]);
  });

  test("reports false for an unknown id", () => {
    expect(database.remove(9999)).toBe(false);
  });

  test.each([0, -1, 1.5, Number.NaN])("rejects the id %p", (id) => {
    expect(() => database.remove(id)).toThrow("شناسه یادداشت نامعتبر است");
  });
});

describe("persistence", () => {
  test("keeps data in its own notes.db file on disk", () => {
    database.create("ماندگار", "متن");

    expect(existsSync(path.join(database.userDataPath, "notes.db"))).toBe(true);
  });
});
