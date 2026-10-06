import { Check, CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { NoteBodyEditor, type BodyEditor } from "@/components/note-body-editor";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { TitleEmojiPicker } from "@/components/title-emoji-picker";
import { getNotesBridge, type Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 800;

const TITLE_EMOJI_CLASS = "text-xl leading-none";

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

function pendingPayload(
  latest: { title: string; body: string },
  saved: string,
): { title: string; body: string } | null {
  return payloadKey(latest) === saved ? null : latest;
}

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

type SaveStatus = "idle" | "saving" | "saved" | "error";

const STATUS_ICONS: Record<SaveStatus, LucideIcon> = {
  idle: Check,
  saving: Loader2,
  saved: Check,
  error: CircleAlert,
};

export function NoteEditor({ note }: { note: Note }) {
  const { update, setIsSaving } = useNotesStore();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [initialBody] = useState(note.body);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const Icon = STATUS_ICONS[status];

  const savedRef = useRef(payloadKey({ title: note.title, body: note.body }));
  const [initialTitle] = useState(note.title);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyAnchorRef = useRef<HTMLDivElement>(null);
  const bodyEditorRef = useRef<BodyEditor | null>(null);
  const latestRef = useRef({ title, body });

  const handleBodyReady = useCallback((editor: BodyEditor) => {
    bodyEditorRef.current = editor;
  }, []);

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
    const flushSync = () => {
      const data = pendingPayload(latestRef.current, savedRef.current);
      if (data === null) return;
      getNotesBridge()?.updateSync(note.id, data);
      savedRef.current = payloadKey(data);
    };

    window.addEventListener("beforeunload", flushSync);
    window.addEventListener("pagehide", flushSync);

    return () => {
      window.removeEventListener("beforeunload", flushSync);
      window.removeEventListener("pagehide", flushSync);

      const data = pendingPayload(latestRef.current, savedRef.current);
      if (data !== null) void commit(data);
    };
  }, [commit, note.id]);

  useEffect(() => {
    const data = pendingPayload({ title, body }, savedRef.current);
    if (data === null) return;

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
    const container = bodyAnchorRef.current?.closest("main");
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 80) {
      container.scrollTop = container.scrollHeight;
    }
  }, [body]);

  const isStatusVisible = status !== "idle" || message !== null;

  const moveCaretToBody = () => {
    setIsPickerOpen(false);
    const editor = bodyEditorRef.current;
    if (editor === null) return;

    editor.commands.focus("end");
    const element = editor.view.dom;
    const container = element.closest("main");
    if (container !== null) revealCaret(container, element);
  };

  const insertEmoji = (emoji: string) => {
    const element = titleRef.current;
    if (element === null) return;
    focusAtEnd(element);
    document.execCommand(
      "insertHTML",
      false,
      `<span class="${TITLE_EMOJI_CLASS}">${emoji}</span>`,
    );
  };

  useEffect(() => {
    const titleElement = titleRef.current;
    if (titleElement !== null) {
      titleElement.textContent = initialTitle;
      focusAtEnd(titleElement);
    }
  }, [initialTitle]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 px-6 py-8 pb-14">
        <div className="flex flex-col gap-2 pb-2">
          <div
            ref={titleRef}
            contentEditable
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
            className="min-h-[1em] w-full cursor-text border-b border-border bg-transparent pb-3 text-3xl leading-tight font-bold whitespace-pre-wrap transition-colors duration-300 outline-none before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)] focus:border-ring"
          />
          <div className="flex justify-start">
            <TitleEmojiPicker
              onSelect={insertEmoji}
              open={isPickerOpen}
              onOpenChange={setIsPickerOpen}
            />
          </div>
        </div>
        <div ref={bodyAnchorRef} className="note-body min-h-[1em] w-full">
          <NoteBodyEditor
            body={initialBody}
            onChange={setBody}
            onReady={handleBodyReady}
          />
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed top-4 left-6 z-10 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-sm transition-opacity duration-300",
          isStatusVisible ? "opacity-100" : "pointer-events-none opacity-0",
          message !== null
            ? "text-destructive"
            : "text-green-800 dark:text-green-400",
        )}
      >
        <span className="grid size-4 shrink-0 place-items-center">
          <Icon
            className={cn("size-4", status === "saving" && "animate-spin")}
          />
        </span>
        {message ?? (status === "saving" ? "در حال ذخیره..." : "ذخیره شد")}
      </div>

      <ScrollToTopButton anchorRef={bodyAnchorRef} />
    </div>
  );
}
