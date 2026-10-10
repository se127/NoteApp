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

function toEpochSeconds(sqliteTimestamp: string): number {
  return Date.parse(`${sqliteTimestamp.replace(" ", "T")}Z`) / 1000;
}

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

describe("replaceAllNotes", () => {
  test("drops every existing note", () => {
    database.create("قدیمی", "متن");
    database.create("دیگر", "");

    database.replaceAll(["تنها"]);

    expect(database.list().map((note) => note.title)).toEqual(["تنها"]);
  });

  test("stores every title with an empty body", () => {
    database.replaceAll(["یک", "دو", "سه"]);

    expect(database.list().map((note) => note.body)).toEqual(["", "", ""]);
  });

  test("lists the titles in the order they were given", () => {
    database.replaceAll(["جدیدترین", "میانی", "قدیمی‌ترین"]);

    expect(database.list().map((note) => note.title)).toEqual([
      "جدیدترین",
      "میانی",
      "قدیمی‌ترین",
    ]);
  });

  test("restarts the ids at one so routes stay stable", () => {
    database.create("قدیمی", "");
    database.create("دیگر", "");

    database.replaceAll(["تنها"]);

    expect(database.list()[0]?.id).toBe(1);
  });

  test("spaces the timestamps one minute apart", () => {
    database.replaceAll(["یک", "دو", "سه"]);

    const times = database.list().map((note) => toEpochSeconds(note.createdAt));

    expect(times[0]! - times[1]!).toBe(60);
    expect(times[1]! - times[2]!).toBe(60);
  });

  test("places the newest note one minute before now", () => {
    database.replaceAll(["جدیدترین"]);

    const elapsed =
      Math.floor(Date.now() / 1000) -
      toEpochSeconds(database.list()[0]!.createdAt);

    expect(elapsed).toBe(60);
  });

  test("spaces the timestamps so the newest note sorts first", () => {
    database.replaceAll(["جدیدترین", "قدیمی‌ترین"]);

    const [newest, oldest] = database.list();

    expect(newest?.createdAt > (oldest?.createdAt ?? "")).toBe(true);
  });

  test("leaves the table empty for an empty title list", () => {
    database.create("قدیمی", "");

    database.replaceAll([]);

    expect(database.list()).toEqual([]);
  });
});

describe("persistence", () => {
  test("keeps data in its own notes.db file on disk", () => {
    database.create("ماندگار", "متن");

    expect(existsSync(path.join(database.userDataPath, "notes.db"))).toBe(true);
  });
});
