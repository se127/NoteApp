export type Note = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type NewNote = {
  title: string;
  body: string;
};

/** The notes bridge exposed by electron/preload.cjs. */
export type NotesBridge = {
  list: () => Promise<Note[]>;
  create: (note: NewNote) => Promise<Note>;
  remove: (id: number) => Promise<boolean>;
  /** Resolves to null when the note no longer exists. */
  update: (id: number, note: NewNote) => Promise<Note | null>;
  onChanged: (callback: () => void) => () => void;
};

type WithBridge = { noteApp?: { notes?: NotesBridge } };

/**
 * The bridge is only present inside Electron. `bun run dev:web` serves the
 * renderer in a plain browser, where there is no database to talk to.
 */
export function getNotesBridge(): NotesBridge | null {
  if (typeof window === "undefined") return null;

  const bridge = (window as WithBridge).noteApp?.notes;
  return bridge ?? null;
}

export class NotesUnavailableError extends Error {
  constructor() {
    super("Notes are only available in the Electron app");
    this.name = "NotesUnavailableError";
  }
}
