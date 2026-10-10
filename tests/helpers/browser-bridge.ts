import type { NewNote, Note, NotesBridge } from "../../src/lib/notes";
import type { Accent, Theme } from "../../src/lib/theme";

type ChangeListener = () => void;

export type FakeNotesBridge = NotesBridge & {
  notes: Note[];
  setTotalCount: (total: number) => void;
  emitChanged: () => void;
  failList: (error: Error) => void;
  failCount: (error: Error) => void;
  failCreate: (error: Error) => void;
  failUpdate: (error: Error) => void;
  failRemove: (error: Error) => void;
  syncedUpdates: Array<{ id: number; title: string; body: string }>;
};

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: "یادداشت",
    body: "متن",
    createdAt: "2026-01-01 10:00:00",
    updatedAt: "2026-01-01 10:00:00",
    ...overrides,
  };
}

export function createFakeNotesBridge(initial: Note[] = []): FakeNotesBridge {
  const notes = [...initial];
  const listeners: ChangeListener[] = [];

  let listError: Error | null = null;
  let countError: Error | null = null;
  let createError: Error | null = null;
  let updateError: Error | null = null;
  let removeError: Error | null = null;

  const syncedUpdates: Array<{ id: number; title: string; body: string }> = [];

  let totalCountOverride: number | null = null;

  function guard(error: Error | null): void {
    if (error !== null) throw error;
  }

  const bridge: FakeNotesBridge = {
    notes,
    syncedUpdates,
    setTotalCount: (total) => {
      totalCountOverride = total;
    },
    failList: (error) => {
      listError = error;
    },
    failCount: (error) => {
      countError = error;
    },
    failCreate: (error) => {
      createError = error;
    },
    failUpdate: (error) => {
      updateError = error;
    },
    failRemove: (error) => {
      removeError = error;
    },
    emitChanged: () => {
      for (const listener of [...listeners]) listener();
    },
    list: async () => {
      guard(listError);
      return notes.map((note) => ({ ...note }));
    },
    count: async () => {
      guard(countError);
      return totalCountOverride ?? notes.length;
    },
    create: async (note: NewNote) => {
      guard(createError);
      const created = makeNote({
        id: Math.max(0, ...notes.map((item) => item.id)) + 1,
        title: note.title,
        body: note.body,
      });
      notes.unshift(created);
      return { ...created };
    },
    remove: async (id: number) => {
      guard(removeError);
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    },
    update: async (id: number, note: NewNote) => {
      guard(updateError);
      const index = notes.findIndex((item) => item.id === id);
      if (index === -1) return null;
      notes[index] = { ...notes[index], ...note };
      return { ...notes[index] };
    },
    updateSync: (id: number, note: NewNote) => {
      syncedUpdates.push({ id, ...note });
    },
    onChanged: (callback: ChangeListener) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };

  return bridge;
}

export function installNotesBridge(bridge: FakeNotesBridge): FakeNotesBridge {
  (globalThis as unknown as Record<string, unknown>)["NoteApp"] = {
    notes: bridge,
  };
  return bridge;
}

export function installThemeBridge(
  initial: Theme = "system",
  initialAccent: Accent = "blue",
): {
  get: () => Theme;
  set: (theme: Theme) => void;
  accent: {
    get: () => Accent;
    set: (accent: Accent) => void;
  };
} {
  let current = initial;
  let currentAccent = initialAccent;
  const theme = {
    get: () => current,
    set: (next: Theme) => {
      current = next;
    },
    accent: {
      get: () => currentAccent,
      set: (next: Accent) => {
        currentAccent = next;
      },
    },
  };

  (globalThis as unknown as Record<string, unknown>)["NoteApp"] = { theme };

  return theme;
}

export type FakeMediaQuery = {
  setMatches: (matches: boolean) => void;
  listeners: Set<(event: MediaQueryListEvent) => void>;
  restore: () => void;
};

export function stubMatchMedia(initialMatches = false): FakeMediaQuery {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const original = window.matchMedia;
  let matches = initialMatches;

  window.matchMedia = ((query: string) => {
    const list = {
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: never) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: never) => {
        listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };

    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    listeners,
    setMatches: (next: boolean) => {
      matches = next;
      for (const listener of [...listeners]) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    restore: () => {
      window.matchMedia = original;
    },
  };
}
