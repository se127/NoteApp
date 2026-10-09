import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import type { Note } from "@/lib/notes";
import { NotesPage } from "@/pages/notes-page";
import { NEW_NOTE_SHORTCUT } from "@/lib/shortcuts";
import { createFakeStore } from "./helpers/fake-store";
import { fireHover } from "./helpers/hover";
import { renderWithProviders } from "./helpers/render";

type Store = ReturnType<typeof createFakeStore>;

let created: Array<{ title: string; body: string }> = [];
let createFailure: Error | null = null;

function buildStore(overrides: Partial<Store> = {}): Store {
  const base = createFakeStore({
    create: async (note) => {
      if (createFailure !== null) throw createFailure;

      created.push({ ...note });
      return {
        id: 99,
        title: note.title,
        body: note.body,
        createdAt: "2026-01-01 10:00:00",
        updatedAt: "2026-01-01 10:00:00",
      };
    },
  });

  return { ...base, ...overrides };
}

function renderPage(store = buildStore(), notes: Note[] = []) {
  return renderWithProviders(<NotesPage />, {
    store: { ...store, notes },
  });
}

beforeEach(() => {
  created = [];
  createFailure = null;
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

describe("NotesPage states", () => {
  test("shows a loading message while notes are read", () => {
    renderPage(buildStore({ isLoading: true }));

    expect(screen.getByText("در حال بارگذاری...")).toBeDefined();
  });

  test("shows an empty state with no notes", () => {
    renderPage();

    expect(screen.getByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("shows the store error instead of the table", () => {
    renderPage(buildStore({ error: "پایگاه داده خراب است" }));

    expect(screen.getByRole("alert").textContent).toBe("پایگاه داده خراب است");
  });

  test("labels the notes table for assistive technology", () => {
    renderPage(buildStore(), [
      { id: 1, title: "اول", body: "", createdAt: "", updatedAt: "" },
    ]);

    expect(screen.getByRole("table", { name: "یادداشت‌ها" })).toBeDefined();
  });
});

describe("NotesPage creating a note", () => {
  test("creates an empty note", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toEqual({ title: "", body: "" });
  });

  test("reports a create failure", async () => {
    createFailure = new Error("ساخت ناموفق بود");

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("ساخت ناموفق بود"),
    );
  });

  test("falls back to a generic create message", async () => {
    const store = buildStore({
      create: async () => {
        throw "boom";
      },
    });

    renderPage(store);
    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "ساخت یادداشت ناموفق بود",
      ),
    );
  });

  test("disables the button while another note is saving", () => {
    renderPage(buildStore({ isSaving: true }));

    const button = screen.getByRole("button", { name: "یادداشت جدید" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

function pressCtrl(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("NotesPage new note tooltip", () => {
  test("names the new note shortcut in its tooltip", async () => {
    renderPage();

    fireHover(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").textContent).toContain("یادداشت جدید");
  });

  test("puts the combination in the tooltip kbd", async () => {
    renderPage();

    fireHover(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").querySelector("kbd")?.textContent).toBe(
      NEW_NOTE_SHORTCUT.combination,
    );
  });
});

describe("NotesPage Ctrl+N new note", () => {
  test("creates an empty note", async () => {
    renderPage();

    pressCtrl("n");

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toEqual({ title: "", body: "" });
  });

  test("prevents the default window behavior", () => {
    renderPage();

    expect(pressCtrl("n").defaultPrevented).toBe(true);
  });

  test("reports a create failure", async () => {
    createFailure = new Error("ساخت ناموفق بود");

    renderPage();
    pressCtrl("n");

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("ساخت ناموفق بود"),
    );
  });

  test("ignores a repeated shortcut while a note is being created", async () => {
    let attempts = 0;
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const store = buildStore({
      create: async (note) => {
        attempts += 1;
        await gate;
        return {
          id: 99,
          title: note.title,
          body: note.body,
          createdAt: "2026-01-01 10:00:00",
          updatedAt: "2026-01-01 10:00:00",
        };
      },
    });

    renderPage(store);

    pressCtrl("n");
    await screen.findByRole("button", { name: "در حال ساخت..." });
    pressCtrl("n");

    expect(attempts).toBe(1);

    await act(async () => {
      release();
    });

    await waitFor(() => expect(attempts).toBe(1));
    expect(screen.getByRole("button", { name: "یادداشت جدید" })).toBeDefined();
  });

  test("ignores the shortcut while another note is saving", async () => {
    renderPage(buildStore({ isSaving: true }));

    pressCtrl("n");

    await Bun.sleep(200);
    expect(created).toHaveLength(0);
  });

  test("leaves a bare key to the editor", async () => {
    renderPage();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await Bun.sleep(200);
    expect(created).toHaveLength(0);
  });

  test("creates a note on a persian keyboard layout", async () => {
    renderPage();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ن",
          code: "KeyN",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(created).toHaveLength(1));
  });
});
