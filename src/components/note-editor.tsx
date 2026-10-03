import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 800;

const SAVE_FAILED_MESSAGE = "ذخیره یادداشت ناموفق بود";

function payloadKey(data: { title: string; body: string }): string {
  return JSON.stringify([data.title, data.body]);
}

export function NoteEditor({ note }: { note: Note }) {
  const { update, setIsSaving } = useNotesStore();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const savedRef = useRef(payloadKey({ title: note.title, body: note.body }));
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const initialBodyRef = useRef(note.body);
  const latestRef = useRef({ title, body });

  useEffect(() => {
    latestRef.current = { title, body };
  }, [title, body]);

  const commit = useCallback(
    async (data: { title: string; body: string }) => {
      await update(note.id, data);
      savedRef.current = payloadKey(data);
    },
    [note.id, update],
  );

  useEffect(() => {
    return () => {
      const data = latestRef.current;
      if (payloadKey(data) === savedRef.current) return;
      void commit(data);
    };
  }, [commit]);

  useEffect(() => {
    const data = { title, body };
    if (payloadKey(data) === savedRef.current) return;

    const timer = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        setStatus("saving");
        try {
          await commit(data);
          setMessage(null);
          setStatus("saved");
        } catch (cause) {
          setStatus("error");
          setMessage(
            cause instanceof Error ? cause.message : SAVE_FAILED_MESSAGE,
          );
        } finally {
          setIsSaving(false);
        }
      })();
    }, SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [title, body, commit, setIsSaving]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const container = bodyRef.current?.closest("main");
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 80) {
      container.scrollTop = container.scrollHeight;
    }
  }, [body]);

  useEffect(() => {
    const element = titleRef.current;
    if (element === null) return;

    const scrollContainer = element.closest("main");
    const scrollTop = scrollContainer?.scrollTop ?? 0;
    const previousHeight = element.clientHeight;

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;

    if (element.clientHeight < previousHeight && scrollContainer) {
      scrollContainer.scrollTop = scrollTop;
    }
  }, [title]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.textContent = initialBodyRef.current;
    }
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 px-6 py-8">
        <textarea
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="عنوان"
          autoFocus
          aria-label="عنوان"
          rows={1}
          className="w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-bold outline-none placeholder:text-muted-foreground/40"
        />
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="متن یادداشت"
          data-placeholder="متن یادداشت را اینجا بنویسید..."
          onInput={(event) => {
            const element = event.currentTarget;
            const text = element.textContent ?? "";
            if (text === "" && element.innerHTML !== "") {
              element.innerHTML = "";
            }
            setBody(text);
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          className="min-h-[1em] w-full cursor-text bg-transparent text-base leading-8 outline-none before:text-muted-foreground/40 empty:before:content-[attr(data-placeholder)]"
        />
      </div>

      {(status === "saving" || status === "saved" || message !== null) && (
        <div
          className={cn(
            "fixed bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-sm",
            message !== null
              ? "text-destructive"
              : "text-green-800 dark:text-green-400",
          )}
        >
          {status === "saving" && <Loader2 className="size-4 animate-spin" />}
          {message ?? (status === "saving" ? "در حال ذخیره..." : "ذخیره شد")}
        </div>
      )}
    </div>
  );
}
