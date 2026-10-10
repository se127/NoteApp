import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { NotesTable } from "@/components/notes-table";
import type { Note } from "@/lib/notes";
import { NotesStoreContext } from "@/lib/notes-store";
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
  return renderWithProviders(
    <NotesTable
      notes={notes}
      isSelecting={false}
      selectedIds={[]}
      onToggleSelect={() => {}}
    />,
    { store },
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

  test("draws the divider on the sticky cells so it scrolls with the header", () => {
    for (const classes of headClasses(COLUMNS)) {
      expect(classes).toContain("shadow-[inset_0_-1px_0_var(--border)]");
      expect(classes).not.toContain("border-b");
    }
  });

  test("overrides the divider the vendored header row ships with", () => {
    renderTable([noteWith({})]);

    const header = screen
      .getByRole("table", { name: "یادداشت ها" })
      .querySelector('[data-slot="table-header"]');

    expect(header?.className).toContain("[&_tr]:border-0!");
  });
});

describe("NotesTable virtualization", () => {
  const ROW_HEIGHT = 48;
  const NOTE_COUNT = 500;

  function manyNotes(count = NOTE_COUNT): Note[] {
    return Array.from({ length: count }, (_, index) =>
      noteWith({ id: index + 1, title: `یادداشت ${index + 1}` }),
    );
  }

  function bodyRows(): HTMLElement[] {
    return screen
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-index")) as HTMLElement[];
  }

  function spacerRows(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll('tr[aria-hidden="true"]'),
    ) as HTMLElement[];
  }

  function scrollTo(row: number, container: HTMLElement): void {
    const scroller = container.querySelector(
      "[data-virtual-scroll]",
    ) as HTMLDivElement;

    act(() => {
      scroller.scrollTop = ROW_HEIGHT * row;
      fireEvent.scroll(scroller);
    });
  }

  test("keeps only the rows that fit in the scroller", () => {
    renderTable(manyNotes());

    const rendered = bodyRows();

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(NOTE_COUNT);
  });

  test("numbers the rows so the virtualizer can read a height back", () => {
    renderTable(manyNotes());

    expect(bodyRows()[0]?.getAttribute("data-index")).toBe("0");
  });

  test("reserves the height of every note so the last one is reachable", () => {
    const { container } = renderTable(manyNotes());

    const reserved = spacerRows(container).reduce(
      (sum, row) => sum + Number.parseInt(row.style.height, 10),
      0,
    );

    expect(reserved + bodyRows().length * ROW_HEIGHT).toBe(
      NOTE_COUNT * ROW_HEIGHT,
    );
  });

  test("reserves the space of the notes scrolled past", () => {
    const { container } = renderTable(manyNotes());

    scrollTo(400, container);

    const firstIndex = Number(bodyRows()[0]?.getAttribute("data-index"));

    expect(spacerRows(container)[0]?.style.height).toBe(
      `${firstIndex * ROW_HEIGHT}px`,
    );
  });

  test("swaps the rendered rows when the list is scrolled", () => {
    const { container } = renderTable(manyNotes());

    expect(bodyRows()[0]?.getAttribute("data-index")).toBe("0");

    scrollTo(400, container);

    const indexes = bodyRows().map((row) => row.getAttribute("data-index"));

    expect(indexes).toContain("400");
    expect(indexes).toContain("401");
    expect(indexes).not.toContain("0");
    expect(bodyRows().length).toBeLessThan(NOTE_COUNT / 10);
    expect(screen.queryByRole("link", { name: "یادداشت 1" })).toBeNull();
  });

  test("keeps the note rows in the table flow so the columns line up", () => {
    const { container } = renderTable(manyNotes());

    const rows = container.querySelectorAll("tr[data-index]");

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.className).not.toContain("absolute");
      expect((row as HTMLElement).style.transform).toBe("");
    }
  });
});

describe("NotesTable scrolling down, up and down again", () => {
  const PAGE = 15;
  const TOTAL = 60;
  const ROW_HEIGHT = 48;

  function noteAt(index: number): Note {
    return noteWith({ id: index + 1, title: `یادداشت ${index + 1}` });
  }

  function GrowthHarness({
    snapshots,
  }: {
    snapshots: number[][];
  }): React.ReactElement {
    const [notes, setNotes] = useState<Note[]>(() =>
      Array.from({ length: PAGE }, (_, index) => noteAt(index)),
    );

    const store = createFakeStore({
      notes,
      totalCount: TOTAL,
      hasMore: notes.length < TOTAL,
      loadMore: async () => {
        const next = Array.from(
          { length: Math.min(TOTAL, notes.length + PAGE) },
          (_, index) => noteAt(index),
        );
        snapshots.push(next.map((note) => note.id));
        setNotes(next);
      },
    });

    return (
      <NotesStoreContext.Provider value={store}>
        <NotesTable
          notes={notes}
          isSelecting={false}
          selectedIds={[]}
          onToggleSelect={() => {}}
        />
      </NotesStoreContext.Provider>
    );
  }

  function scrollTo(container: HTMLElement, row: number): void {
    const scroller = container.querySelector(
      "[data-virtual-scroll]",
    ) as HTMLDivElement;

    act(() => {
      scroller.scrollTop = ROW_HEIGHT * row;
      fireEvent.scroll(scroller);
    });
  }

  function renderedTitles(container: HTMLElement): string[] {
    return Array.from(
      container.querySelectorAll("tr[data-index] td:first-child"),
    )
      .map((cell) => cell.textContent ?? "")
      .filter((text) => text.includes("یادداشت"));
  }

  test("never shows a note twice no matter how fast the list is thrown around", async () => {
    const snapshots: number[][] = [];
    const { container } = renderWithProviders(
      <GrowthHarness snapshots={snapshots} />,
    );

    await waitFor(() => expect(snapshots.length).toBeGreaterThan(0));

    for (let bounce = 0; bounce < 12; bounce += 1) {
      scrollTo(container, TOTAL);
      scrollTo(container, 0);
    }

    for (let burst = 0; burst < 12; burst += 1) {
      scrollTo(container, TOTAL);
    }

    await waitFor(() => expect(snapshots.length).toBeGreaterThan(1));

    for (const ids of snapshots) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("grows by one page and keeps the rows already loaded in place", async () => {
    const snapshots: number[][] = [];
    const { container } = renderWithProviders(
      <GrowthHarness snapshots={snapshots} />,
    );

    await waitFor(() => expect(snapshots.length).toBeGreaterThan(0));

    for (let bounce = 0; bounce < 12; bounce += 1) {
      scrollTo(container, TOTAL);
      scrollTo(container, 0);
    }

    await waitFor(() => expect(snapshots.length).toBeGreaterThan(2));

    for (let step = 1; step < snapshots.length; step += 1) {
      const previous = snapshots[step - 1] ?? [];
      const current = snapshots[step] ?? [];

      expect(current.slice(0, previous.length)).toEqual(previous);
      expect(current.length - previous.length).toBe(PAGE);
    }
  });

  test("keeps the rows unique inside the table itself", async () => {
    const snapshots: number[][] = [];
    const { container } = renderWithProviders(
      <GrowthHarness snapshots={snapshots} />,
    );

    await waitFor(() => expect(snapshots.length).toBeGreaterThan(0));
    scrollTo(container, TOTAL);
    await waitFor(() => expect(snapshots.length).toBeGreaterThan(1));

    const titles = renderedTitles(container);

    expect(titles.length).toBeGreaterThan(0);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("NotesTable infinite scrolling", () => {
  const PAGE = 15;

  function manyNotes(count: number): Note[] {
    return Array.from({ length: count }, (_, index) =>
      noteWith({ id: index + 1, title: `یادداشت ${index + 1}` }),
    );
  }

  function renderPaging(store: Partial<ReturnType<typeof createFakeStore>>) {
    return renderWithProviders(
      <NotesTable
        notes={manyNotes(PAGE)}
        isSelecting={false}
        selectedIds={[]}
        onToggleSelect={() => {}}
      />,
      { store: createFakeStore(store) },
    );
  }

  test("shows a centered loader while the next page is on its way", () => {
    renderPaging({ isLoadingMore: true });

    const loader = screen.getByRole("status");

    expect(loader.textContent).toContain(
      "در حال بارگذاری یادداشت های بیشتر...",
    );
    expect(loader.className).toContain("justify-center");
    expect(loader.parentElement?.className).toContain("text-center");
  });

  test("keeps the loader in the table body so the columns still line up", () => {
    renderPaging({ isLoadingMore: true });

    const cell = screen.getByRole("status").closest("td");

    expect(cell?.getAttribute("colspan")).toBe("3");
    expect(cell?.closest("table")).not.toBeNull();
  });

  test("hides the loader when nothing is loading", () => {
    renderPaging({ isLoadingMore: false });

    expect(screen.queryByRole("status")).toBeNull();
  });

  test("asks for the next page once the last row is in view", async () => {
    let loads = 0;

    renderPaging({
      hasMore: true,
      loadMore: async () => {
        loads += 1;
      },
    });

    await waitFor(() => expect(loads).toBe(1));
  });

  test("does not ask for more when every note is already loaded", async () => {
    let loads = 0;

    renderPaging({
      hasMore: false,
      loadMore: async () => {
        loads += 1;
      },
    });

    await act(async () => {});

    expect(loads).toBe(0);
  });

  test("does not ask again while the next page is still loading", async () => {
    let loads = 0;

    renderPaging({
      hasMore: true,
      isLoadingMore: true,
      loadMore: async () => {
        loads += 1;
      },
    });

    await act(async () => {});

    expect(loads).toBe(0);
  });

  test("renders each row once no matter how many times the page is asked for", () => {
    renderPaging({ hasMore: true, loadMore: async () => {} });

    const rendered = screen
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-index"));

    const indexes = rendered.map((row) => row.getAttribute("data-index"));

    expect(new Set(indexes).size).toBe(indexes.length);
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
