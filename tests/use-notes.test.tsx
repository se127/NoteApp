import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useNotes } from "@/hooks/use-notes";
import type { Note } from "@/lib/notes";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
  type FakeNotesBridge,
} from "./helpers/browser-bridge";

function removeBridge(): void {
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
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
