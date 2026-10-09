import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import { NotesTable } from "@/components/notes-table";
import type { Note } from "@/lib/notes";
import { createFakeStore } from "./helpers/fake-store";
import { renderWithProviders } from "./helpers/render";

let removedIds: number[] = [];
let removeFailure: Error | null = null;

function buildStore() {
  return createFakeStore({
    remove: async (id) => {
      if (removeFailure !== null) throw removeFailure;

      removedIds.push(id);
      return true;
    },
  });
}

function renderTable(notes: Note[], store = buildStore()) {
  return renderWithProviders(<NotesTable notes={notes} />, { store });
}

function noteWith(overrides: Partial<Note>): Note {
  return {
    id: 1,
    title: "یادداشت",
    body: "",
    createdAt: "2026-01-01 10:00:00",
    updatedAt: "2026-01-01 10:00:00",
    ...overrides,
  };
}

function fireHover(element: Element): void {
  act(() => {
    element.dispatchEvent(
      new MouseEvent("mouseenter", { bubbles: false, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: false, cancelable: true }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(() => {
  removedIds = [];
  removeFailure = null;
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

describe("NotesTable rows", () => {
  test("gives every note a row linking to its editor", () => {
    renderTable([
      noteWith({ id: 1, title: "اول" }),
      noteWith({ id: 2, title: "دوم" }),
    ]);

    expect(screen.getByRole("link", { name: "اول" }).getAttribute("href")).toBe(
      "/notes/1/edit",
    );
    expect(screen.getByRole("link", { name: "دوم" }).getAttribute("href")).toBe(
      "/notes/2/edit",
    );
  });

  test("names the three columns", () => {
    renderTable([noteWith({})]);

    expect(screen.getByRole("columnheader", { name: "عنوان" })).toBeDefined();
    expect(
      screen.getByRole("columnheader", { name: "زمان ایجاد" }),
    ).toBeDefined();
    expect(
      screen.getByRole("columnheader", { name: "گزینه ها" }),
    ).toBeDefined();
  });

  test("wraps a long title over several lines instead of truncating it", () => {
    const title =
      "یک عنوان بسیار بلند که باید در چند سطر بشکند و در یک سطر محدود نشود";

    renderTable([noteWith({ title })]);

    const link = screen.getByRole("link", { name: title });
    expect(link.className).toContain("break-words");
    expect(link.closest("td")?.className).toContain("whitespace-normal");
  });

  test("shows a placeholder for an empty title", () => {
    renderTable([noteWith({ title: "   " })]);

    expect(screen.getByRole("link", { name: "بدون عنوان" })).toBeDefined();
  });

  test("shows how long ago the note was created", () => {
    renderTable([noteWith({ createdAt: "" })]);

    expect(screen.getByText("—")).toBeDefined();
  });

  test("shows the full fa-IR date when the created time is hovered", async () => {
    const { container } = renderTable([noteWith({})]);

    fireHover(container.querySelector("time") as HTMLElement);

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
  });
});

async function openDeleteDialogFor(note: Note): Promise<void> {
  const trigger = screen.getByRole("button", {
    name: `گزینه های یادداشت ${note.title}`,
  });

  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);

  fireEvent.click(await screen.findByRole("menuitem", { name: "حذف" }));
}

describe("NotesTable deleting a note", () => {
  const note = noteWith({ id: 7, title: "برای حذف" });

  test("asks for confirmation before deleting", async () => {
    renderTable([note]);

    await openDeleteDialogFor(note);

    expect(
      await screen.findByText("آیا از حذف این یادداشت مطمئن هستید؟"),
    ).toBeDefined();
    expect(removedIds).toHaveLength(0);
  });

  test("shows the note title inside the confirmation", async () => {
    renderTable([note]);

    await openDeleteDialogFor(note);

    expect(
      await screen.findByText(
        "«برای حذف» برای همیشه حذف می‌شود و قابل بازگشت نیست.",
      ),
    ).toBeDefined();
  });

  test("deletes the note once confirmed", async () => {
    renderTable([note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() => expect(removedIds).toEqual([7]));
  });

  test("does not delete when the confirmation is cancelled", async () => {
    renderTable([note]);

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

    renderTable([note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    expect(await screen.findByText("حذف ناموفق بود")).toBeDefined();
  });

  test("falls back to a generic delete message", async () => {
    const store = createFakeStore({
      remove: async () => {
        throw "boom";
      },
    });

    renderTable([note], store);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    expect(await screen.findByText("حذف یادداشت ناموفق بود")).toBeDefined();
  });
});
