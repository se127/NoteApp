import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getNotesBridge, type NewNote, type Note } from "@/lib/notes";

const UNAVAILABLE_MESSAGE = "پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است";
const READ_FAILED_MESSAGE = "خواندن یادداشت ها ناموفق بود";

export const NOTES_PAGE_SIZE = 15;

export function useNotes() {
  const bridge = useMemo(() => getNotesBridge(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(bridge !== null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    bridge === null ? UNAVAILABLE_MESSAGE : null,
  );

  const notesRef = useRef<Note[]>([]);
  const totalCountRef = useRef(0);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const replaceNotes = useCallback((next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
  }, []);

  const appendNotes = useCallback((next: Note[]) => {
    if (next.length === 0) return;

    const merged = [...notesRef.current, ...next];
    notesRef.current = merged;
    setNotes(merged);
  }, []);

  const refreshRows = useCallback(async () => {
    if (bridge === null) return;

    generationRef.current += 1;
    const generation = generationRef.current;
    const limit = Math.max(notesRef.current.length, NOTES_PAGE_SIZE);

    const [listed, counted] = await Promise.all([
      bridge.list(limit, 0),
      bridge.count(),
    ]);

    if (generation !== generationRef.current) return;

    totalCountRef.current = counted;
    setTotalCount(counted);
    replaceNotes(listed);
  }, [bridge, replaceNotes]);

  const refresh = useCallback(async () => {
    if (bridge === null) return;

    try {
      await refreshRows();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : READ_FAILED_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [bridge, refreshRows]);

  useEffect(() => {
    if (bridge === null) return;

    queueMicrotask(() => void refresh());

    return bridge.onChanged(() => void refresh());
  }, [bridge, refresh]);

  const loadMore = useCallback(async () => {
    if (bridge === null || loadingMoreRef.current) return;

    const offset = notesRef.current.length;
    if (offset >= totalCountRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const generation = generationRef.current;

    try {
      const page = await bridge.list(NOTES_PAGE_SIZE, offset);

      if (generation !== generationRef.current) return;

      appendNotes(page);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : READ_FAILED_MESSAGE);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [appendNotes, bridge]);

  const create = useCallback(
    async (note: { title: string; body: string }) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const created = await bridge.create(note);
      await refreshRows();
      return created;
    },
    [bridge, refreshRows],
  );

  const remove = useCallback(
    async (id: number) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const deleted = await bridge.remove(id);
      await refreshRows();
      return deleted;
    },
    [bridge, refreshRows],
  );

  const removeMany = useCallback(
    async (ids: number[]) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const deleted = await bridge.removeMany(ids);
      await refreshRows();
      return deleted;
    },
    [bridge, refreshRows],
  );

  const update = useCallback(
    async (id: number, note: NewNote) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const updated = await bridge.update(id, note);
      await refreshRows();
      return updated;
    },
    [bridge, refreshRows],
  );

  return {
    notes,
    totalCount,
    hasMore: notes.length < totalCount,
    isLoading,
    isLoadingMore,
    isSaving,
    setIsSaving,
    error,
    loadMore,
    create,
    remove,
    removeMany,
    update,
  };
}
