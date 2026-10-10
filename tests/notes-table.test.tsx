import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { NotesTable } from "@/components/notes-table";
import type { Note } from "@/lib/notes";
import type { SortDirection } from "@/lib/relative-time";
import { SORT_NOTES_SHORTCUT } from "@/lib/shortcuts";
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
  return renderWithProviders(<SortingHarness notes={notes} />, { store });
}

function SortingHarness({
  notes,
  initialDirection = "desc",
}: {
  notes: Note[];
  initialDirection?: SortDirection;
}) {
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  return (
    <NotesTable
      notes={notes}
      isSelecting={false}
      selectedIds={[]}
      onToggleSelect={() => {}}
      direction={direction}
      onToggleDirection={() =>
        setDirection((previous) => (previous === "desc" ? "asc" : "desc"))
      }
    />
  );
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

describe("NotesTable sticky header", () => {
  function headClasses(names: string[]): string[] {
    renderTable([noteWith({})]);

    return names.map(
      (name) => screen.getByRole("columnheader", { name }).className,
    );
  }

  const COLUMNS = ["عنوان", "زمان ایجاد", "گزینه ها"];

  test("pins every column to the top of the scroller", () => {
    for (const classes of headClasses(COLUMNS)) {
      expect(classes).toContain("sticky");
      expect(classes).toContain("top-0");
    }
  });

  test("paints an opaque background behind every column so rows cannot show through", () => {
    for (const classes of headClasses(COLUMNS)) {
      expect(classes).toContain("bg-background");
    }
  });

  test("stacks the header above the rows", () => {
    renderTable([noteWith({})]);

    expect(
      screen.getByRole("columnheader", { name: "عنوان" }).className,
    ).toContain("z-10");
  });
});

describe("NotesTable edited time", () => {
  function editedNote(): Note {
    return noteWith({
      createdAt: "2026-01-01 10:00:00",
      updatedAt: "2026-01-02 11:30:00",
    });
  }

  test("shows the edited time below the title once the note changed", () => {
    renderTable([editedNote()]);

    expect(screen.getByText(/^ویرایش شده:/)).toBeDefined();
  });

  test("labels the edited time with a colon before the relative time", () => {
    renderTable([editedNote()]);

    expect(screen.getByText(/^ویرایش شده: .+/).textContent).toStartWith(
      "ویرایش شده: ",
    );
  });

  test("keeps the edited time out of the link name", () => {
    renderTable([editedNote()]);

    expect(screen.getByRole("link", { name: "یادداشت" })).toBeDefined();
  });

  test("hides the edited time when the note was never touched", () => {
    renderTable([noteWith({})]);

    expect(screen.queryByText(/ویرایش شده/)).toBeNull();
  });

  test("shows the edited time in the muted small style", () => {
    renderTable([editedNote()]);

    const label = screen.getByText(/^ویرایش شده:/);
    expect(label.className).toContain("text-muted-foreground");
    expect(label.className).toContain("text-xs");
  });

  test("shows the full fa-IR date when the edited time is hovered", async () => {
    renderTable([editedNote()]);

    fireHover(screen.getByText(/^ویرایش شده:/));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
  });
});

describe("NotesTable created time sorting", () => {
  const notes = [
    noteWith({ id: 1, title: "تازه", createdAt: "2026-03-01 10:00:00" }),
    noteWith({ id: 2, title: "میانی", createdAt: "2026-02-01 10:00:00" }),
    noteWith({ id: 3, title: "قدیمی", createdAt: "2026-01-01 10:00:00" }),
  ];

  function renderedTitles(): (string | null)[] {
    return screen.getAllByRole("link").map((link) => link.textContent);
  }

  function sortButton(): HTMLElement {
    return screen.getByRole("button", { name: "زمان ایجاد" });
  }

  test("keeps the newest note first on the default descending order", () => {
    renderTable(notes);

    expect(renderedTitles()).toEqual(["تازه", "میانی", "قدیمی"]);
  });

  test("puts the oldest note first once the header is clicked", () => {
    renderTable(notes);

    fireEvent.click(sortButton());

    expect(renderedTitles()).toEqual(["قدیمی", "میانی", "تازه"]);
  });

  test("goes back to the newest first on a second click", () => {
    renderTable(notes);

    fireEvent.click(sortButton());
    fireEvent.click(sortButton());

    expect(renderedTitles()).toEqual(["تازه", "میانی", "قدیمی"]);
  });

  test("keeps the newest first after an even number of clicks", () => {
    renderTable(notes);

    fireEvent.click(sortButton());
    fireEvent.click(sortButton());
    fireEvent.click(sortButton());
    fireEvent.click(sortButton());

    expect(renderedTitles()).toEqual(["تازه", "میانی", "قدیمی"]);
  });

  test("names the coming descending order in the tooltip", async () => {
    renderTable(notes);

    fireHover(sortButton());

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toStartWith(
        "مرتب سازی از قدیم به جدید",
      ),
    );
  });

  test("names the coming ascending order in the tooltip after a click", async () => {
    renderTable(notes);

    fireEvent.click(sortButton());
    fireHover(sortButton());

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toStartWith(
        "مرتب سازی از جدید به قدیم",
      ),
    );
  });

  test("names the combination in the tooltip kbd", async () => {
    renderTable(notes);

    fireHover(sortButton());

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").querySelector("kbd")?.textContent).toBe(
      SORT_NOTES_SHORTCUT.combination,
    );
  });

  test("reports the descending order on the column header", () => {
    renderTable(notes);

    expect(
      screen
        .getByRole("columnheader", { name: "زمان ایجاد" })
        .getAttribute("aria-sort"),
    ).toBe("descending");
  });

  test("reports the ascending order on the column header after a click", () => {
    renderTable(notes);

    fireEvent.click(sortButton());

    expect(
      screen
        .getByRole("columnheader", { name: "زمان ایجاد" })
        .getAttribute("aria-sort"),
    ).toBe("ascending");
  });

  test("points the icon down while the newest note comes first", () => {
    const { container } = renderTable(notes);

    expect(
      container.querySelector(
        "th[aria-sort='descending'] .lucide-arrow-down-wide-narrow",
      ),
    ).not.toBeNull();
  });

  test("points the icon up once the order is flipped", () => {
    const { container } = renderTable(notes);

    fireEvent.click(sortButton());

    expect(
      container.querySelector(
        "th[aria-sort='ascending'] .lucide-arrow-up-narrow-wide",
      ),
    ).not.toBeNull();
  });

  test("drops the other icon so only one shows", () => {
    const { container } = renderTable(notes);

    expect(container.querySelector(".lucide-arrow-up-narrow-wide")).toBeNull();

    fireEvent.click(sortButton());

    expect(
      container.querySelector(".lucide-arrow-down-wide-narrow"),
    ).toBeNull();
  });

  test("holds the icon after the heading inside the button", () => {
    renderTable(notes);

    expect(sortButton().textContent).toStartWith("زمان ایجاد");
  });

  test("shows a pointer cursor so the header reads as clickable", () => {
    renderTable(notes);

    expect(sortButton().className).toContain("cursor-pointer");
  });

  test("has no native title tooltip to compete with", () => {
    renderTable(notes);

    expect(sortButton().getAttribute("title")).toBeNull();
  });

  test("leaves the props array alone", () => {
    renderTable(notes);

    fireEvent.click(sortButton());

    expect(notes.map((note) => note.title)).toEqual(["تازه", "میانی", "قدیمی"]);
  });

  const tiedNotes = [
    noteWith({ id: 1, title: "کمتر", createdAt: "2026-01-01 10:00:00" }),
    noteWith({ id: 2, title: "بیشتر", createdAt: "2026-01-01 10:00:00" }),
  ];

  test("breaks a tie on the created time by id, newest first", () => {
    renderTable(tiedNotes);

    expect(renderedTitles()).toEqual(["بیشتر", "کمتر"]);
  });

  test("breaks a tie on the created time by id, oldest first", () => {
    renderTable(tiedNotes);

    fireEvent.click(sortButton());

    expect(renderedTitles()).toEqual(["کمتر", "بیشتر"]);
  });
});

describe("NotesTable select mode", () => {
  const notes = [
    noteWith({ id: 1, title: "اول" }),
    noteWith({ id: 2, title: "دوم" }),
  ];

  function renderSelecting(
    selectedIds: number[] = [],
    onToggleSelect: (id: number) => void = () => {},
  ) {
    return renderWithProviders(
      <NotesTable
        notes={notes}
        isSelecting
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        direction="desc"
        onToggleDirection={() => {}}
      />,
      { store: buildStore() },
    );
  }

  test("shows no checkbox while the mode is off", () => {
    renderTable(notes);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("puts a checkbox before the title of every note", () => {
    renderSelecting();

    expect(
      screen.getByRole("checkbox", { name: "انتخاب یادداشت اول" }),
    ).toBeDefined();
    expect(
      screen.getByRole("checkbox", { name: "انتخاب یادداشت دوم" }),
    ).toBeDefined();
  });

  test("turns the title into a toggle instead of a link", () => {
    renderSelecting();

    expect(screen.queryByRole("link", { name: "اول" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "اول" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  test("toggles the checkbox when the title is clicked", () => {
    const toggled: number[] = [];
    renderSelecting([], (id) => toggled.push(id));

    fireEvent.click(screen.getByRole("button", { name: "دوم" }));

    expect(toggled).toEqual([2]);
  });

  test("toggles the checkbox itself", () => {
    const toggled: number[] = [];
    renderSelecting([], (id) => toggled.push(id));

    fireEvent.click(
      screen.getByRole("checkbox", { name: "انتخاب یادداشت اول" }),
    );

    expect(toggled).toEqual([1]);
  });

  test("marks the selected titles as pressed", () => {
    renderSelecting([2]);

    expect(
      screen.getByRole("button", { name: "دوم" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: "انتخاب یادداشت دوم" })
        .getAttribute("data-state"),
    ).toBe("checked");
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

  test("gives the options button the outline style", () => {
    renderTable([note]);

    const trigger = screen.getByRole("button", {
      name: "گزینه های یادداشت برای حذف",
    });

    expect(trigger.getAttribute("data-variant")).toBe("outline");
    expect(trigger.getAttribute("data-size")).toBe("icon");
    expect(trigger.className).toContain("size-8");
  });

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
        "«برای حذف» برای همیشه حذف می شود و قابل بازگشت نیست.",
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

  test("keeps the options menu open after the confirmation is cancelled", async () => {
    renderTable([note]);

    await openDeleteDialogFor(note);
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(
        screen.queryByText("آیا از حذف این یادداشت مطمئن هستید؟"),
      ).toBeNull(),
    );
    expect(screen.getByRole("menuitem", { name: "حذف" })).toBeDefined();
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
