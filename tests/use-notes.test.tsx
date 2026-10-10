import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { NOTES_PAGE_SIZE, useNotes } from "@/hooks/use-notes";
import type { Note } from "@/lib/notes";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
  type FakeNotesBridge,
} from "./helpers/browser-bridge";

function removeBridge(): void {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
}

describe("useNotes without the electron bridge", () => {
  beforeEach(removeBridge);

  test("reports that the database is desktop only", () => {
    const { result } = renderHook(() => useNotes());

    expect(result.current.error).toBe(
      "پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است",
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.notes).toEqual([]);
  });

  test("refuses to create, remove and update", async () => {
    const { result } = renderHook(() => useNotes());

    await expect(
      result.current.create({ title: "a", body: "b" }),
    ).rejects.toThrow("پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است");
    await expect(result.current.remove(1)).rejects.toThrow();
    await expect(result.current.removeMany([1, 2])).rejects.toThrow();
    await expect(
      result.current.update(1, { title: "", body: "" }),
    ).rejects.toThrow();
  });
});

describe("useNotes with the electron bridge", () => {
  let bridge: FakeNotesBridge;

  beforeEach(() => {
    bridge = installNotesBridge(createFakeNotesBridge());
  });

  afterEach(removeBridge);

  test("loads notes on mount", async () => {
    bridge.notes.push(makeNote({ id: 1, title: "اول" }));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  test("starts in the loading state", () => {
    const { result } = renderHook(() => useNotes());

    expect(result.current.isLoading).toBe(true);
  });

  test("surfaces a list failure and stops loading", async () => {
    bridge.failList(new Error("دیتابیس قفل است"));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("دیتابیس قفل است");
  });

  test("reloads when the main process broadcasts a change", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      bridge.notes.push(makeNote({ id: 7, title: "تازه" }));
      bridge.emitChanged();
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(result.current.notes[0]?.title).toBe("تازه");
  });

  test("reads the total from the count query, not from the list length", async () => {
    bridge.setTotalCount(1200);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.totalCount).toBe(1200);
  });

  test("counts every note once the list has loaded", async () => {
    bridge.notes.push(makeNote({ id: 1 }), makeNote({ id: 2 }));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalCount).toBe(2);
  });

  test("follows the total when the main process broadcasts a change", async () => {
    bridge.notes.push(makeNote({ id: 4 }));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.totalCount).toBe(1));

    act(() => {
      bridge.notes.push(makeNote({ id: 5 }));
      bridge.emitChanged();
    });

    await waitFor(() => expect(result.current.totalCount).toBe(2));
  });

  test("surfaces a count failure and stops loading", async () => {
    bridge.failCount(new Error("شمارش ناموفق بود"));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("شمارش ناموفق بود");
  });

  test("keeps the total in step with a create", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.create({ title: "تازه", body: "متن" });
    });

    expect(result.current.totalCount).toBe(1);
  });

  test("keeps the total in step with a delete", async () => {
    bridge.notes.push(makeNote({ id: 8 }));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.totalCount).toBe(1));

    await act(async () => {
      await result.current.remove(8);
    });

    expect(result.current.totalCount).toBe(0);
  });

  test("stops listening to broadcasts after unmount", async () => {
    const { result, unmount } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();
    bridge.notes.push(makeNote({ id: 9 }));

    act(() => {
      bridge.emitChanged();
    });

    expect(result.current.notes).toHaveLength(0);
  });

  test("create returns the new note and refreshes the list", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Note | undefined;
    await act(async () => {
      created = await result.current.create({ title: "تازه", body: "متن" });
    });

    expect(created?.title).toBe("تازه");
    expect(result.current.notes).toHaveLength(1);
  });

  test("remove reports whether the note existed and refreshes", async () => {
    const { result } = renderHook(() => useNotes());
    bridge.notes.push(makeNote({ id: 5 }));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    let removed: boolean | undefined;
    await act(async () => {
      removed = await result.current.remove(5);
    });

    expect(removed).toBe(true);
    expect(result.current.notes).toHaveLength(0);
  });

  test("removeMany drops the whole selection in one refresh", async () => {
    const { result } = renderHook(() => useNotes());
    bridge.notes.push(makeNote({ id: 5 }), makeNote({ id: 6 }));
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    const readsBefore = bridge.requestedLimits.length;

    let deleted = 0;
    await act(async () => {
      deleted = await result.current.removeMany([5, 6]);
    });

    expect(deleted).toBe(2);
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
    expect(bridge.requestedLimits.length - readsBefore).toBe(1);
  });

  test("removeMany ignores ids that are already gone", async () => {
    const { result } = renderHook(() => useNotes());
    bridge.notes.push(makeNote({ id: 5 }));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    let deleted = 0;
    await act(async () => {
      deleted = await result.current.removeMany([5, 404]);
    });

    expect(deleted).toBe(1);
    expect(result.current.notes).toHaveLength(0);
  });

  test("removeMany propagates a failure to the caller", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    bridge.failRemoveMany(new Error("حذف گروهی ناموفق بود"));

    await expect(result.current.removeMany([1, 2])).rejects.toThrow(
      "حذف گروهی ناموفق بود",
    );
  });

  test("remove returns false for an unknown id", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let removed: boolean | undefined;
    await act(async () => {
      removed = await result.current.remove(404);
    });

    expect(removed).toBe(false);
  });

  test("update returns the changed note and refreshes", async () => {
    bridge.notes.push(makeNote({ id: 3, title: "قدیمی" }));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    let updated: Note | null | undefined;
    await act(async () => {
      updated = await result.current.update(3, {
        title: "جدید",
        body: "متن جدید",
      });
    });

    expect(updated?.title).toBe("جدید");
    expect(result.current.notes[0]?.title).toBe("جدید");
  });

  test("update returns null for an unknown id", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let updated: Note | null | undefined;
    await act(async () => {
      updated = await result.current.update(404, { title: "x", body: "" });
    });

    expect(updated).toBeNull();
  });

  test("propagates a create failure to the caller", async () => {
    bridge.failCreate(new Error("ساخت ناموفق بود"));
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.create({ title: "a", body: "" }),
    ).rejects.toThrow("ساخت ناموفق بود");
  });

  test("tracks the saving flag", () => {
    const { result } = renderHook(() => useNotes());

    expect(result.current.isSaving).toBe(false);
    act(() => result.current.setIsSaving(true));
    expect(result.current.isSaving).toBe(true);
  });
});

describe("useNotes paging", () => {
  const PAGE = 15;
  let bridge: FakeNotesBridge;

  function seed(count: number): Note[] {
    const seeded = Array.from({ length: count }, (_, index) =>
      makeNote({ id: count - index, title: `یادداشت ${count - index}` }),
    );
    bridge.notes.push(...seeded);
    return seeded;
  }

  function ids(notes: Note[]): number[] {
    return notes.map((note) => note.id);
  }

  beforeEach(() => {
    bridge = installNotesBridge(createFakeNotesBridge());
  });

  afterEach(removeBridge);

  test("reads the first page on mount", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(bridge.requestedLimits[0]).toBe(PAGE);
    expect(bridge.requestedOffsets[0]).toBe(0);
    expect(result.current.notes).toHaveLength(PAGE);
    expect(result.current.totalCount).toBe(50);
  });

  test("reports that more notes wait behind the first page", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);
  });

  test("asks for only the rows past the end, never the ones already held", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(bridge.requestedOffsets.at(-1)).toBe(PAGE);
    expect(bridge.requestedLimits.at(-1)).toBe(PAGE);
  });

  test("appends the next page in order with no row repeated or skipped", async () => {
    const seeded = seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(ids(result.current.notes)).toEqual(
      seeded.slice(0, PAGE * 2).map((note) => note.id),
    );
  });

  test("keeps every row unique across many pages", async () => {
    const seeded = seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
      await result.current.loadMore();
    });

    const loaded = ids(result.current.notes);

    expect(loaded).toEqual(seeded.slice(0, PAGE * 3).map((note) => note.id));
    expect(new Set(loaded).size).toBe(loaded.length);
  });

  test("grows by exactly one page per trigger", async () => {
    seed(200);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    const sizes: number[] = [];
    for (let step = 0; step < 4; step += 1) {
      await act(async () => {
        await result.current.loadMore();
      });
      sizes.push(result.current.notes.length);
    }

    expect(sizes).toEqual([30, 45, 60, 75]);
  });

  test("reads each page from a different offset", async () => {
    seed(200);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
      await result.current.loadMore();
    });

    expect(bridge.requestedOffsets.slice(-2)).toEqual([PAGE, PAGE * 2]);
  });

  test("drops a page that arrives after the list was refreshed", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    const read = bridge.list;
    let resolvePage = () => {};
    let pageRequested = false;

    bridge.list = async (limit: number, offset = 0) => {
      if (!pageRequested) {
        pageRequested = true;
        await new Promise<void>((resolve) => {
          resolvePage = resolve;
        });
      }
      return read(limit, offset);
    };

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.loadMore();
    });

    await waitFor(() => expect(pageRequested).toBe(true));

    act(() => {
      bridge.emitChanged();
    });

    resolvePage();
    await pending;

    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.notes).toHaveLength(PAGE);
  });

  test("ignores further triggers while a page is still on its way", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    const read = bridge.list;
    const pending: Array<() => void> = [];
    let callsWhilePending = 0;

    bridge.list = async (limit: number, offset = 0) => {
      callsWhilePending += 1;
      await new Promise<void>((resolve) => {
        pending.push(resolve);
      });
      return read(limit, offset);
    };

    await act(async () => {
      const first = result.current.loadMore();
      await result.current.loadMore();
      await result.current.loadMore();

      for (const resolve of pending) resolve();
      await first;
    });

    expect(callsWhilePending).toBe(1);
    expect(result.current.notes).toHaveLength(PAGE * 2);
    expect(result.current.isLoadingMore).toBe(false);
  });

  test("re-reads the rows already held after a change instead of appending", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
    });

    act(() => {
      bridge.emitChanged();
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE * 2));

    expect(bridge.requestedOffsets.at(-1)).toBe(0);
    expect(bridge.requestedLimits.at(-1)).toBe(PAGE * 2);
  });

  test("stops asking once every note is loaded", async () => {
    seed(20);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.notes).toHaveLength(20);
    expect(result.current.hasMore).toBe(false);

    const requestsSoFar = bridge.requestedOffsets.length;

    await act(async () => {
      await result.current.loadMore();
    });

    expect(bridge.requestedOffsets).toHaveLength(requestsSoFar);
  });

  test("keeps the rows already loaded when a page fails", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    bridge.failList(new Error("دیتابیس قفل است"));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe("دیتابیس قفل است");
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.notes).toHaveLength(PAGE);

    bridge.clearFailures();

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.notes).toHaveLength(PAGE * 2);
  });

  test("refuses to page without the bridge", async () => {
    removeBridge();

    const { result } = renderHook(() => useNotes());

    await result.current.loadMore();

    expect(result.current.notes).toHaveLength(0);
    expect(result.current.isLoadingMore).toBe(false);
  });

  test("keeps the loaded size after a new note is created", async () => {
    seed(50);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(PAGE));

    await act(async () => {
      await result.current.loadMore();
    });

    await act(async () => {
      await result.current.create({ title: "تازه", body: "" });
    });

    expect(result.current.notes).toHaveLength(PAGE * 2);
    expect(bridge.requestedOffsets.at(-1)).toBe(0);
  });
});

describe("useNotes page size", () => {
  test("loads fifteen notes at a time", () => {
    expect(NOTES_PAGE_SIZE).toBe(15);
  });
});
