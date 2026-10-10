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

export type NotesBridge = {
  list: (limit: number, offset?: number) => Promise<Note[]>;
  count: () => Promise<number>;
  create: (note: NewNote) => Promise<Note>;
  remove: (id: number) => Promise<boolean>;
  update: (id: number, note: NewNote) => Promise<Note | null>;
  updateSync: (id: number, note: NewNote) => void;
  onChanged: (callback: () => void) => () => void;
};

type WithBridge = { NoteApp?: { notes?: NotesBridge } };

export function getNotesBridge(): NotesBridge | null {
  if (typeof window === "undefined") return null;

  const bridge = (window as WithBridge).NoteApp?.notes;
  return bridge ?? null;
}
