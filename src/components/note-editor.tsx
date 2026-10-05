import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getNotesBridge, type Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 800;

const SAVE_FAILED_MESSAGE = "ذخیره یادداشت ناموفق بود";

function payloadKey(data: { title: string; body: string }): string {
  return JSON.stringify([data.title, data.body]);
}

function syncPlainText(element: HTMLElement): string {
  const text = element.textContent ?? "";
  if (text === "" && element.innerHTML !== "") {
    element.innerHTML = "";
  }
  return text;
}

const FORMATTING_SHORTCUTS = new Set(["b", "i", "u"]);

function revealCaret(container: Element, element: HTMLElement): void {
  const selection = window.getSelection();
  const range =
    selection !== null && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

  const caret = range?.getBoundingClientRect();
  const bounds = container.getBoundingClientRect();
  const rect =
    caret !== undefined && caret.height > 0
      ? caret
      : element.getBoundingClientRect();

  const maxScrollTop = container.scrollHeight - container.clientHeight;
  let target = container.scrollTop;

  if (rect.top < bounds.top) {
    target -= bounds.top - rect.top;
  } else if (rect.bottom > bounds.bottom) {
    target = maxScrollTop;
  }

  const clamped = Math.min(Math.max(target, 0), maxScrollTop);
  if (clamped === container.scrollTop) return;

  container.scrollTo({ top: clamped, behavior: "smooth" });
}

function focusAtEnd(element: HTMLElement): void {
  element.focus();

  const selection = window.getSelection();
  if (selection === null) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  const container = element.closest("main");
  if (container !== null) revealCaret(container, element);
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
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const initialBodyRef = useRef(note.body);
  const initialTitleRef = useRef(note.title);
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
    const flushOnExit = () => {
      const data = latestRef.current;
      if (payloadKey(data) === savedRef.current) return;
      getNotesBridge()?.updateSync(note.id, data);
      savedRef.current = payloadKey(data);
    };

    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);

    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [note.id]);

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

  const moveCaretToBody = () => {
    const body = bodyRef.current;
    if (body !== null) focusAtEnd(body);
  };

  useEffect(() => {
    const title = titleRef.current;
    if (title === null) return;
    title.textContent = initialTitleRef.current;
    focusAtEnd(title);
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.textContent = initialBodyRef.current;
    }
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 px-6 py-8">
        <div
          ref={titleRef}
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="false"
          aria-label="عنوان"
          data-placeholder="عنوان"
          onInput={(event) => setTitle(syncPlainText(event.currentTarget))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              moveCaretToBody();
              return;
            }
            const isFormatting =
              (event.ctrlKey || event.metaKey) &&
              FORMATTING_SHORTCUTS.has(event.key.toLowerCase());
            if (isFormatting) event.preventDefault();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData
              .getData("text/plain")
              .replace(/\s+/g, " ");
            document.execCommand("insertText", false, text);
          }}
          className="min-h-[1em] w-full cursor-text bg-transparent text-3xl leading-tight font-bold whitespace-pre-wrap outline-none before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]"
        />
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="متن یادداشت"
          data-placeholder="متن یادداشت را اینجا بنویسید..."
          onInput={(event) => setBody(syncPlainText(event.currentTarget))}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          className="min-h-[1em] w-full cursor-text bg-transparent text-base leading-8 outline-none before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]"
        />
      </div>

      {(status === "saving" || status === "saved" || message !== null) && (
        <div
          className={cn(
            "fixed top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-sm",
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
