import { afterEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { NotesProvider } from "@/components/notes-provider";
import { useNotesStore } from "@/lib/notes-store";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
} from "./helpers/browser-bridge";

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
});

describe("useNotesStore", () => {
  test("throws when used outside a NotesProvider", () => {
    expect(() => renderHook(() => useNotesStore())).toThrow(
      "useNotesStore must be used within a NotesProvider",
    );
  });

  test("returns the store from the provider", async () => {
    installNotesBridge(
      createFakeNotesBridge([makeNote({ id: 4, title: "از پرووایدر" })]),
    );

    const { result } = renderHook(() => useNotesStore(), {
      wrapper: NotesProvider,
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(result.current.notes[0]?.title).toBe("از پرووایدر");
  });

  test("exposes the saving flag and its setter", () => {
    installNotesBridge(createFakeNotesBridge());

    const { result } = renderHook(() => useNotesStore(), {
      wrapper: NotesProvider,
    });

    expect(result.current.isSaving).toBe(false);
    act(() => result.current.setIsSaving(true));
    expect(result.current.isSaving).toBe(true);
  });
});
