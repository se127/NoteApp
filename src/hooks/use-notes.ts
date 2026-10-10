import { useCallback, useEffect, useMemo, useState } from "react";

import { getNotesBridge, type NewNote, type Note } from "@/lib/notes";

const UNAVAILABLE_MESSAGE = "پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است";

export function useNotes() {
  const bridge = useMemo(() => getNotesBridge(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(bridge !== null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    bridge === null ? UNAVAILABLE_MESSAGE : null,
  );

  const reload = useCallback(async () => {
    if (bridge === null) return;

    const [listed, counted] = await Promise.all([
      bridge.list(),
      bridge.count(),
    ]);
    setNotes(listed);
    setTotalCount(counted);
  }, [bridge]);

  const refresh = useCallback(async () => {
    if (bridge === null) return;

    try {
      await reload();
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "خواندن یادداشت ها ناموفق بود",
      );
    } finally {
      setIsLoading(false);
    }
  }, [bridge, reload]);

  useEffect(() => {
    if (bridge === null) return;

    queueMicrotask(() => void refresh());

    return bridge.onChanged(() => void refresh());
  }, [bridge, refresh]);

  const create = useCallback(
    async (note: { title: string; body: string }) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const created = await bridge.create(note);
      await reload();
      return created;
    },
    [bridge, reload],
  );

  const remove = useCallback(
    async (id: number) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const deleted = await bridge.remove(id);
      await reload();
      return deleted;
    },
    [bridge, reload],
  );

  const update = useCallback(
    async (id: number, note: NewNote) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const updated = await bridge.update(id, note);
      await reload();
      return updated;
    },
    [bridge, reload],
  );

  return {
    notes,
    totalCount,
    isLoading,
    isSaving,
    setIsSaving,
    error,
    create,
    remove,
    update,
  };
}
