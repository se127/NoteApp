import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** @type {DatabaseSync | null} */
let db = null;
/** @type {import("node:sqlite").StatementSync | null} */
let listStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let countStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let insertStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let deleteStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let updateStatement = null;

const BUSY_TIMEOUT_MS = 5000;
const MMAP_SIZE_BYTES = 268435456;

const MIGRATIONS = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          title      TEXT    NOT NULL DEFAULT '',
          body       TEXT    NOT NULL DEFAULT '',
          created_at TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes (updated_at DESC);
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      db.exec(
        "CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes (created_at DESC)",
      );
      db.exec("DROP INDEX IF EXISTS notes_updated_at_idx");
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(
        "CREATE INDEX IF NOT EXISTS notes_created_at_id_idx ON notes (created_at DESC, id DESC)",
      );
      db.exec("DROP INDEX IF EXISTS notes_created_at_idx");
    },
  },
];

export function migrate(db) {
  const current = readUserVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    db.exec("BEGIN");

    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function readUserVersion(db) {
  return db.prepare("PRAGMA user_version").get().user_version;
}

export function openDatabase(userDataPath) {
  if (db) return db;

  mkdirSync(userDataPath, { recursive: true });
  db = new DatabaseSync(path.join(userDataPath, "notes.db"), {
    timeout: BUSY_TIMEOUT_MS,
  });

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA cache_size = -8192");
  db.exec(`PRAGMA mmap_size = ${MMAP_SIZE_BYTES}`);
  db.exec("PRAGMA journal_size_limit = 67108864");

  migrate(db);

  listStatement = db.prepare(
    `SELECT id, title, body, created_at AS createdAt, updated_at AS updatedAt
       FROM notes
      ORDER BY created_at DESC, id DESC`,
  );

  countStatement = db.prepare("SELECT COUNT(*) AS total FROM notes");

  insertStatement = db.prepare(
    `INSERT INTO notes (title, body) VALUES (?, ?)
     RETURNING id, title, body, created_at AS createdAt, updated_at AS updatedAt`,
  );

  deleteStatement = db.prepare("DELETE FROM notes WHERE id = ?");

  updateStatement = db.prepare(
    `UPDATE notes
        SET title = ?, body = ?, updated_at = datetime('now')
      WHERE id = ?
 RETURNING id, title, body, created_at AS createdAt, updated_at AS updatedAt`,
  );

  return db;
}

function requireDb() {
  if (!db) throw new Error("Database has not been opened yet");
  return db;
}

/** @returns {Array<{id: number, title: string, body: string, createdAt: string, updatedAt: string}>} */
export function listNotes() {
  requireDb();
  return /** @type {any} */ (listStatement).all();
}

export function countNotes() {
  requireDb();
  return Number(/** @type {any} */ (countStatement).get().total);
}

/** @returns {{id: number, title: string, body: string, createdAt: string, updatedAt: string}} */
export function createNote(title, body) {
  requireDb();

  return /** @type {any} */ (insertStatement).get(title, body);
}

export function deleteNote(id) {
  requireDb();

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("شناسه یادداشت نامعتبر است");
  }

  const result = /** @type {any} */ (deleteStatement).run(id);
  return Number(result.changes) > 0;
}

export function updateNote(id, title, body) {
  requireDb();

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("شناسه یادداشت نامعتبر است");
  }

  const row = /** @type {any} */ (updateStatement).get(title, body, id);

  return row ?? null;
}

export function replaceAllNotes(titles) {
  const database = requireDb();

  database.exec("BEGIN");

  try {
    database.exec("DELETE FROM notes");
    database.exec("DELETE FROM sqlite_sequence WHERE name = 'notes'");

    const insert = database.prepare(
      `INSERT INTO notes (title, body, created_at, updated_at)
       VALUES (?, '', datetime('now', ?), datetime('now', ?))`,
    );

    titles.forEach((title, index) => {
      const age = `-${index + 1} minutes`;
      insert.run(title, age, age);
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function closeDatabase() {
  db?.close();
  db = null;
  listStatement = null;
  countStatement = null;
  insertStatement = null;
  deleteStatement = null;
  updateStatement = null;
}
