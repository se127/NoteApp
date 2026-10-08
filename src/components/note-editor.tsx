import { Check, CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { NoteBodyEditor, type BodyEditor } from "@/components/note-body-editor";
import { Separator } from "@/components/ui/separator";
import { TitleEmojiPicker } from "@/components/title-emoji-picker";
import { getNotesBridge, type Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import {
  isShortcut,
  SAVE_NOTE_SHORTCUT,
  type ShortcutKeys,
  TITLE_EMOJI_SHORTCUT,
  toolbarShortcut,
} from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 800;

const SAVE_FAILED_MESSAGE = "ذخیره یادداشت ناموفق بود";

type NotePayload = { title: string; body: string };

function payloadKey(data: NotePayload): string {
  return JSON.stringify([data.title, data.body]);
}

function syncPlainText(element: HTMLElement): string {
  const text = element.textContent ?? "";
  if (text === "" && element.innerHTML !== "") {
    element.innerHTML = "";
  }
  return text;
}

const FORMATTING_INPUT_PREFIX = "format";

const BOLD_SHORTCUT = toolbarShortcut("bold");
const ITALIC_SHORTCUT = toolbarShortcut("italic");
const UNDERLINE_SHORTCUT = toolbarShortcut("underline");

function isFormattingShortcut(event: ShortcutKeys): boolean {
  return [BOLD_SHORTCUT, ITALIC_SHORTCUT, UNDERLINE_SHORTCUT].some((shortcut) =>
    isShortcut(event, shortcut),
  );
}

function isFormattingInputType(inputType: string): boolean {
  return inputType.startsWith(FORMATTING_INPUT_PREFIX);
}

function unwrapForeignMarkup(element: HTMLElement): void {
  for (const node of [...element.querySelectorAll("*")]) {
    node.replaceWith(...node.childNodes);
  }
}

function pendingPayload(
  latest: NotePayload,
  saved: string,
): NotePayload | null {
  return payloadKey(latest) === saved ? null : latest;
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
}

function caretRangeIn(element: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return element.contains(range.startContainer) ? range.cloneRange() : null;
}

function restoreCaret(
  element: HTMLElement,
  fallback: (element: HTMLElement) => void,
): void {
  const saved = caretRangeIn(element);

  if (saved === null) {
    fallback(element);
    return;
  }

  element.focus();

  const selection = window.getSelection();
  if (selection === null) return;

  selection.removeAllRanges();
  selection.addRange(saved);
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBodyReady = useCallback((editor: BodyEditor) => {
    bodyEditorRef.current = editor;
  }, []);

  useEffect(() => {
    latestRef.current = { title, body };
  }, [title, body]);

  const commit = useCallback(
    async (data: NotePayload) => {
      await update(note.id, data);
      savedRef.current = payloadKey(data);
    },
    [note.id, update],
  );

  const saveNow = useCallback(
    async (data: NotePayload) => {
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
    },
    [commit, setIsSaving],
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
      debounceTimerRef.current = null;
      void saveNow(data);
    }, SAVE_DELAY);

    debounceTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current === timer) {
        debounceTimerRef.current = null;
      }
    };
  }, [title, body, saveNow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, SAVE_NOTE_SHORTCUT)) return;

      event.preventDefault();

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      void saveNow(latestRef.current);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [saveNow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, TITLE_EMOJI_SHORTCUT)) return;

      event.preventDefault();
      setIsPickerOpen((wasOpen) => !wasOpen);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const container = bodyAnchorRef.current?.closest("[data-note-scroll]");
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
  };

  const insertEmoji = (emoji: string) => {
    const element = titleRef.current;
    if (element === null) return;
    restoreCaret(element, focusAtEnd);
    document.execCommand("insertText", false, emoji);
  };

  useEffect(() => {
    const element = titleRef.current;
    if (element === null) return;

    const handleBeforeInput = (event: Event) => {
      const inputType = (event as InputEvent).inputType ?? "";
      if (isFormattingInputType(inputType)) event.preventDefault();
    };

    element.addEventListener("beforeinput", handleBeforeInput);
    return () => element.removeEventListener("beforeinput", handleBeforeInput);
  }, []);

  useEffect(() => {
    const titleElement = titleRef.current;
    if (titleElement !== null) {
      titleElement.textContent = initialTitle;
      focusAtEnd(titleElement);
    }
  }, [initialTitle]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-8">
        <div className="flex items-center gap-2 px-6 pb-2">
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="false"
            aria-label="عنوان"
            data-placeholder="عنوان"
            onInput={(event) => {
              unwrapForeignMarkup(event.currentTarget);
              setTitle(syncPlainText(event.currentTarget));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                moveCaretToBody();
                return;
              }
              if (isFormattingShortcut(event)) event.preventDefault();
            }}
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData
                .getData("text/plain")
                .replace(/\s+/g, " ");
              document.execCommand("insertText", false, text);
            }}
            className="min-h-[1em] min-w-0 flex-1 cursor-text bg-transparent pb-3 text-3xl leading-tight font-bold whitespace-pre-wrap outline-none before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]"
          />
          <Separator orientation="vertical" className="mb-1" />
          <TitleEmojiPicker
            onSelect={insertEmoji}
            open={isPickerOpen}
            onOpenChange={setIsPickerOpen}
          />
        </div>
        <div
          ref={bodyAnchorRef}
          className="note-body flex min-h-0 w-full flex-1 flex-col"
        >
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
    </div>
  );
}
