import { useCallback, useEffect, useMemo, useState } from "react";

import { getNotesBridge, type Note } from "@/lib/notes";

const UNAVAILABLE_MESSAGE = "پایگاه داده فقط در اپلیکیشن دسکتاپ در دسترس است";

/**
 * Loads the notes list and exposes a create action.
 *
 * The bridge is resolved once: it is a stable object on window, and deciding
 * during render avoids setState on the synchronous path of an effect.
 */
export function useNotes() {
  const bridge = useMemo(() => getNotesBridge(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(bridge !== null);
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

    // Fetched inside promise callbacks rather than via refresh(), so no
    // setState runs synchronously in the effect body. `active` guards against
    // updating after unmount.
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

    // Another window may add notes; refetch when the main process says so.
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
      // Refetch rather than splicing locally: the main process is the source
      // of truth for ordering.
      setNotes(await bridge.list());
      return deleted;
    },
    [bridge],
  );

  return { notes, isLoading, error, create, remove };
}
