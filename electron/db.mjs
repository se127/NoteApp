/**
 * SQLite access for the notes table.
 *
 * Uses node:sqlite, which ships with the Node build inside Electron, so there
 * is no native module to compile or rebuild against Electron's ABI.
 *
 * Lives in the main process: the renderer runs sandboxed with no Node access,
 * so all queries go through IPC (see ipc handlers in main.mjs).
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL DEFAULT '',
    body       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes (updated_at DESC);
`;

/** @type {DatabaseSync | null} */
let db = null;
/** @type {import("node:sqlite").StatementSync | null} */
let listStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let insertStatement = null;
/** @type {import("node:sqlite").StatementSync | null} */
let deleteStatement = null;

/** Open (once) and migrate the database inside the app's userData directory. */
export function openDatabase(userDataPath) {
  if (db) return db;

  mkdirSync(userDataPath, { recursive: true });
  db = new DatabaseSync(path.join(userDataPath, "notes.db"));

  // WAL lets the UI keep reading while a write is in flight.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);

  listStatement = db.prepare(
    `SELECT id, title, body, created_at AS createdAt, updated_at AS updatedAt
       FROM notes
      ORDER BY updated_at DESC, id DESC`,
  );

  insertStatement = db.prepare(
    `INSERT INTO notes (title, body) VALUES (?, ?)
     RETURNING id, title, body, created_at AS createdAt, updated_at AS updatedAt`,
  );

  deleteStatement = db.prepare("DELETE FROM notes WHERE id = ?");

  return db;
}

function requireDb() {
  if (!db) throw new Error("Database has not been opened yet");
  return db;
}

const TITLE_MAX = 120;
const BODY_MAX = 5000;

/**
 * Re-check the limits the renderer already enforced with zod. The renderer is
 * untrusted, so anything arriving over IPC is validated again here before it
 * reaches SQLite.
 */
function assertValidNote(title, body) {
  if (typeof title !== "string" || typeof body !== "string") {
    throw new Error("یادداشت نامعتبر است");
  }

  const cleanTitle = title.trim();
  const cleanBody = body.trim();

  if (cleanTitle === "" && cleanBody === "") {
    throw new Error("عنوان یا متن یادداشت را وارد کنید");
  }
  if (cleanTitle.length > TITLE_MAX) {
    throw new Error(`عنوان نباید بیشتر از ${TITLE_MAX} نویسه باشد`);
  }
  if (cleanBody.length > BODY_MAX) {
    throw new Error(`متن نباید بیشتر از ${BODY_MAX} نویسه باشد`);
  }

  return { cleanTitle, cleanBody };
}

/** @returns {Array<{id: number, title: string, body: string, createdAt: string, updatedAt: string}>} */
export function listNotes() {
  requireDb();
  return /** @type {any} */ (listStatement).all();
}

/** @returns {{id: number, title: string, body: string, createdAt: string, updatedAt: string}} */
export function createNote(title, body) {
  requireDb();
  const { cleanTitle, cleanBody } = assertValidNote(title, body);

  return /** @type {any} */ (insertStatement).get(cleanTitle, cleanBody);
}

/**
 * Delete one note by id.
 *
 * @returns {boolean} false when no row matched, so the caller can tell a stale
 * delete (the note was already removed elsewhere) from a successful one.
 */
export function deleteNote(id) {
  requireDb();

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("شناسه یادداشت نامعتبر است");
  }

  const result = /** @type {any} */ (deleteStatement).run(id);
  return Number(result.changes) > 0;
}

export function closeDatabase() {
  db?.close();
  db = null;
  listStatement = null;
  insertStatement = null;
  deleteStatement = null;
}
