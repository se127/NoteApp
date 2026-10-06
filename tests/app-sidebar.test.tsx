import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { AppSidebar } from "@/components/app-sidebar";
import type { Note } from "@/lib/notes";
import { createFakeStore } from "./helpers/fake-store";
import { renderWithProviders } from "./helpers/render";

type Store = ReturnType<typeof createFakeStore>;

let created: Array<{ title: string; body: string }> = [];
let removedIds: number[] = [];
let createFailure: Error | null = null;
let removeFailure: Error | null = null;

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
    remove: async (id) => {
      if (removeFailure !== null) throw removeFailure;
      removedIds.push(id);
      return true;
    },
  });

  return { ...base, ...overrides };
}

function renderSidebar(store = buildStore(), notes: Note[] = []) {
  return renderWithProviders(<AppSidebar />, {
    store: { ...store, notes },
  });
}

beforeEach(() => {
  created = [];
  removedIds = [];
  createFailure = null;
  removeFailure = null;
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
});

describe("AppSidebar states", () => {
  test("shows a loading message while notes are read", () => {
    renderSidebar(buildStore({ isLoading: true }));

    expect(screen.getByText("در حال بارگذاری...")).toBeDefined();
  });

  test("shows an empty state with no notes", () => {
    renderSidebar();

    expect(screen.getByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("shows the store error", () => {
    renderSidebar(buildStore({ error: "پایگاه داده خراب است" }));

    expect(screen.getByRole("alert").textContent).toBe("پایگاه داده خراب است");
  });

  test("lists notes and links to each editor", () => {
    renderSidebar(buildStore(), [
      { id: 1, title: "اول", body: "", createdAt: "", updatedAt: "" },
      { id: 2, title: "دوم", body: "", createdAt: "", updatedAt: "" },
    ]);

    expect(screen.getByRole("link", { name: /اول/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /دوم/ })).toBeDefined();
  });

  test("falls back to a placeholder for an empty title", () => {
    renderSidebar(buildStore(), [
      { id: 1, title: "   ", body: "", createdAt: "", updatedAt: "" },
    ]);

    expect(screen.getByText("بدون عنوان")).toBeDefined();
  });
});

describe("AppSidebar creating a note", () => {
  test("creates an empty note", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toEqual({ title: "", body: "" });
  });

  test("reports a create failure", async () => {
    createFailure = new Error("ساخت ناموفق بود");

    renderSidebar();
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

    renderSidebar(store);
    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "ساخت یادداشت ناموفق بود",
      ),
    );
  });

  test("disables the button while another note is saving", () => {
    renderSidebar(buildStore({ isSaving: true }));

    const button = screen.getByRole("button", { name: "یادداشت جدید" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

async function openDeleteDialogFor(note: Note): Promise<void> {
  const trigger = screen.getByRole("button", {
    name: `گزینه‌های یادداشت ${note.title}`,
  });

  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);

  const menuItem = await screen.findByRole("menuitem", { name: "حذف" });
  fireEvent.click(menuItem);
}

describe("AppSidebar deleting a note", () => {
  const note: Note = {
    id: 7,
    title: "برای حذف",
    body: "",
    createdAt: "",
    updatedAt: "",
  };

  test("asks for confirmation before deleting", async () => {
    renderSidebar(buildStore(), [note]);

    await openDeleteDialogFor(note);
    expect(
      await screen.findByText("آیا از حذف این یادداشت مطمئن هستید؟"),
    ).toBeDefined();
    expect(removedIds).toHaveLength(0);
  });

  test("deletes the note once confirmed", async () => {
    renderSidebar(buildStore(), [note]);

    await openDeleteDialogFor(note);
    const confirm = await screen.findByRole("button", { name: "بله" });

    fireEvent.click(confirm);

    await waitFor(() => expect(removedIds).toEqual([7]));
  });

  test("does not delete when the confirmation is cancelled", async () => {
    renderSidebar(buildStore(), [note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(
        screen.queryByText("آیا از حذف این یادداشت مطمئن هستید؟"),
      ).toBeNull(),
    );
    expect(removedIds).toHaveLength(0);
  });

  test("keeps the dialog open and reports a delete failure", async () => {
    removeFailure = new Error("حذف ناموفق بود");

    renderSidebar(buildStore(), [note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() =>
      expect(screen.getByText("حذف ناموفق بود")).toBeDefined(),
    );
  });

  test("falls back to a generic delete message", async () => {
    const store = buildStore({
      remove: async () => {
        throw "boom";
      },
    });

    renderSidebar(store, [note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() =>
      expect(screen.getByText("حذف یادداشت ناموفق بود")).toBeDefined(),
    );
  });

  test("shows the note title inside the confirmation", async () => {
    renderSidebar(buildStore(), [note]);

    await openDeleteDialogFor(note);
    expect(
      await screen.findByText(
        "«برای حذف» برای همیشه حذف می‌شود و قابل بازگشت نیست.",
      ),
    ).toBeDefined();
  });
});
