import { useCallback, useEffect, useMemo, useState } from "react";

import { getNotesBridge, type NewNote, type Note } from "@/lib/notes";

const UNAVAILABLE_MESSAGE = "پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است";

export function useNotes() {
  const bridge = useMemo(() => getNotesBridge(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(bridge !== null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    bridge === null ? UNAVAILABLE_MESSAGE : null,
  );

  const refresh = useCallback(async () => {
    if (bridge === null) return;

    try {
      setNotes(await bridge.list());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "خواندن یادداشت‌ها ناموفق بود",
      );
    } finally {
      setIsLoading(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (bridge === null) return;

    let active = true;

    bridge.list().then(
      (result) => {
        if (!active) return;
        setNotes(result);
        setError(null);
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "خواندن یادداشت‌ها ناموفق بود",
        );
        setIsLoading(false);
      },
    );

    const unsubscribe = bridge.onChanged(() => void refresh());

    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge, refresh]);

  const create = useCallback(
    async (note: { title: string; body: string }) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const created = await bridge.create(note);
      setNotes(await bridge.list());
      return created;
    },
    [bridge],
  );

  const remove = useCallback(
    async (id: number) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const deleted = await bridge.remove(id);
      setNotes(await bridge.list());
      return deleted;
    },
    [bridge],
  );

  const update = useCallback(
    async (id: number, note: NewNote) => {
      if (bridge === null) {
        throw new Error(UNAVAILABLE_MESSAGE);
      }

      const updated = await bridge.update(id, note);
      setNotes(await bridge.list());
      return updated;
    },
    [bridge],
  );

  return {
    notes,
    isLoading,
    isSaving,
    setIsSaving,
    error,
    create,
    remove,
    update,
  };
}
