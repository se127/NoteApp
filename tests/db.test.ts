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

  test("returns every note when no limit is given", () => {
    for (let index = 0; index < 50; index += 1) database.create("", "");

    expect(database.list()).toHaveLength(50);
  });

  describe("with a limit", () => {
    function seed(count: number): number[] {
      return Array.from({ length: count }, () => database.create("", "")).map(
        (note) => note.id,
      );
    }

    test("reads the newest notes only", () => {
      const ids = seed(50);

      const listed = database.list(15);

      expect(listed).toHaveLength(15);
      expect(listed.map((note) => note.id)).toEqual(ids.slice(-15).reverse());
    });

    test("counts the limit from the first row, so a wider limit extends the same page", () => {
      const ids = seed(50);

      expect(database.list(30).map((note) => note.id)).toEqual(
        ids.slice(-30).reverse(),
      );
    });

    test("never repeats a row when the same limit is read twice", () => {
      seed(50);

      const first = database.list(30);
      const second = database.list(30);

      expect(second.map((note) => note.id)).toEqual(
        first.map((note) => note.id),
      );
    });

    test("returns a short page when fewer notes exist than the limit", () => {
      seed(4);

      expect(database.list(15)).toHaveLength(4);
    });

    test("reads the page that starts at the offset", () => {
      const ids = seed(50);

      expect(database.list(15, 15).map((note) => note.id)).toEqual(
        ids.slice(-30, -15).reverse(),
      );
    });

    test("hands out consecutive pages with no row in two of them", () => {
      const ids = seed(50);

      const first = database.list(15, 0).map((note) => note.id);
      const second = database.list(15, 15).map((note) => note.id);

      expect(first).toHaveLength(15);
      expect(second).toHaveLength(15);
      expect(first.filter((id) => second.includes(id))).toEqual([]);
      expect([...first, ...second]).toEqual(ids.slice(-30).reverse());
    });

    test("returns a short page past the last note", () => {
      seed(10);

      expect(database.list(15, 8)).toHaveLength(2);
    });

    test("returns nothing past the end of the table", () => {
      seed(10);

      expect(database.list(15, 50)).toEqual([]);
    });

    test("returns nothing when the limit is zero", () => {
      seed(5);

      expect(database.list(0)).toEqual([]);
    });

    test.each([-1, 1.5, Number.NaN])(
      "falls back to every note for the limit %p",
      (limit) => {
        seed(5);

        expect(database.list(limit)).toHaveLength(5);
      },
    );

    test("leaves the total count above the page size", () => {
      seed(50);

      expect(database.list(15)).toHaveLength(15);
      expect(database.count()).toBe(50);
    });
  });
});

describe("countNotes", () => {
  test("counts every note without loading them", () => {
    database.create("اول", "");
    database.create("دوم", "");
    database.create("سوم", "");

    expect(database.count()).toBe(3);
  });

  test("counts zero for an empty database", () => {
    expect(database.count()).toBe(0);
  });

  test("counts a number larger than the list query returns", () => {
    for (let index = 0; index < 50; index += 1) database.create("", "");

    expect(database.list()).toHaveLength(50);
    expect(database.count()).toBe(50);
  });

  test("drops as soon as a note is deleted", () => {
    const first = database.create("اول", "");
    database.create("دوم", "");

    expect(database.remove(first.id)).toBe(true);

    expect(database.count()).toBe(1);
  });

  test("is not moved by editing a note", () => {
    const note = database.create("قدیمی", "متن");

    database.update(note.id, "جدید", "متن جدید");

    expect(database.count()).toBe(1);
  });

  test("follows a dev reseed", () => {
    database.create("قدیمی", "");

    database.replaceAll(["یک", "دو"]);

    expect(database.count()).toBe(2);
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
    const note = database.create("حذف شونده", "");

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
    database.replaceAll(["جدیدترین", "میانی", "قدیمی ترین"]);

    expect(database.list().map((note) => note.title)).toEqual([
      "جدیدترین",
      "میانی",
      "قدیمی ترین",
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
    database.replaceAll(["جدیدترین", "قدیمی ترین"]);

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
