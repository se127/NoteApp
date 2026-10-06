import { Placeholder } from "@tiptap/extensions";
import {
  EditorContent,
  Tiptap,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Pilcrow,
  Strikethrough,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { bodyToHtml } from "@/lib/note-body";
import { keepPastedTextInline } from "@/lib/note-paste";
import { cn } from "@/lib/utils";

const BODY_PLACEHOLDER = "متن یادداشت را اینجا بنویسید...";

const HEADING_LEVELS = [2, 3, 4, 5, 6] as const;

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: { levels: [...HEADING_LEVELS] },
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    trailingNode: false,
  }),
  Placeholder.configure({ placeholder: BODY_PLACEHOLDER }),
];

export type BodyEditor = Editor;

type BlockType = {
  label: string;
  level: (typeof HEADING_LEVELS)[number] | null;
  icon: LucideIcon;
};

const BLOCK_TYPES: BlockType[] = [
  { label: "پاراگراف", level: null, icon: Pilcrow },
  { label: "عنوان ۲", level: 2, icon: Heading2 },
  { label: "عنوان ۳", level: 3, icon: Heading3 },
  { label: "عنوان ۴", level: 4, icon: Heading4 },
  { label: "عنوان ۵", level: 5, icon: Heading5 },
  { label: "عنوان ۶", level: 6, icon: Heading6 },
];

function activeBlockType(editor: BodyEditor): BlockType {
  const level = HEADING_LEVELS.find((candidate) =>
    editor.isActive("heading", { level: candidate }),
  );

  return BLOCK_TYPES.find((type) => type.level === level) ?? BLOCK_TYPES[0];
}

function setBlockType(editor: BodyEditor, blockType: BlockType): void {
  const chain = editor.chain().focus();
  if (blockType.level === null) chain.setParagraph().run();
  else chain.setHeading({ level: blockType.level }).run();
}

const BLOCK_SELECTOR = "p, h2, h3, h4, h5, h6";

function caretBlockNode(): Element | null {
  const anchor = document.getSelection()?.anchorNode ?? null;
  const element =
    anchor === null
      ? null
      : anchor.nodeType === Node.TEXT_NODE
        ? anchor.parentElement
        : (anchor as Element);
  return element?.closest(BLOCK_SELECTOR) ?? null;
}

function caretBlockVirtualElement() {
  const node = caretBlockNode();
  if (node === null) return null;

  const rect = node.getBoundingClientRect();

  return {
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  };
}

type MarkAction = {
  label: string;
  icon: LucideIcon;
  isActive: (editor: BodyEditor) => boolean;
  toggle: (editor: BodyEditor) => void;
};

const MARK_ACTIONS: MarkAction[] = [
  {
    label: "ضخیم",
    icon: Bold,
    isActive: (editor) => editor.isActive("bold"),
    toggle: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "مورب",
    icon: Italic,
    isActive: (editor) => editor.isActive("italic"),
    toggle: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "زیرخط",
    icon: UnderlineIcon,
    isActive: (editor) => editor.isActive("underline"),
    toggle: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    label: "خط خورده",
    icon: Strikethrough,
    isActive: (editor) => editor.isActive("strike"),
    toggle: (editor) => editor.chain().focus().toggleStrike().run(),
  },
];

function MarkButton({
  action,
  editor,
}: {
  action: MarkAction;
  editor: BodyEditor;
}) {
  const Icon = action.icon;
  const isActive = useEditorState({
    editor,
    selector: ({ editor: instance }) => action.isActive(instance),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="icon-sm"
          aria-label={action.label}
          aria-pressed={isActive}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => action.toggle(editor)}
          className={cn("rounded-md", !isActive && "text-muted-foreground")}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{action.label}</TooltipContent>
    </Tooltip>
  );
}

function BlockTypeMenu({ editor }: { editor: BodyEditor }) {
  const blockType = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeBlockType(instance),
  });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const TriggerIcon = blockType.icon;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: Event) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);

    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="نوع بلوک"
            aria-haspopup="menu"
            aria-expanded={open}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            className="rounded-md text-muted-foreground"
          >
            <TriggerIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">سبک متن</TooltipContent>
      </Tooltip>
      {open ? (
        <div
          role="menu"
          aria-label="سبک متن"
          className="inset-inline-0 absolute top-full z-30 flex min-w-36 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {BLOCK_TYPES.map((type) => {
            const ItemIcon = type.icon;

            return (
              <button
                key={type.label}
                type="button"
                role="menuitemradio"
                aria-label={type.label}
                aria-checked={type.level === blockType.level}
                onClick={() => {
                  setOpen(false);
                  setBlockType(editor, type);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm text-popover-foreground outline-none hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground",
                  type.level === blockType.level && "bg-muted text-foreground",
                )}
              >
                <ItemIcon className="size-4 shrink-0" />
                {type.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function hasCaretWithoutSelection({
  editor,
  element,
  from,
  to,
}: {
  editor: BodyEditor;
  element: HTMLElement;
  from: number;
  to: number;
}): boolean {
  if (from !== to) return false;
  return element.contains(document.activeElement) || editor.isFocused;
}

export function NoteBodyEditor({
  body,
  onChange,
  onReady,
}: {
  body: string;
  onChange: (html: string) => void;
  onReady?: (editor: BodyEditor) => void;
}) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: bodyToHtml(body),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "متن یادداشت",
        "aria-multiline": "true",
        dir: "rtl",
      },
      transformPasted: keepPastedTextInline,
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (editor !== null) onReady?.(editor);
  }, [editor, onReady]);

  if (editor === null) return null;

  return (
    <Tiptap editor={editor}>
      <BubbleMenu editor={editor} className="z-20">
        <div
          role="toolbar"
          aria-label="قالب‌بندی متن"
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {MARK_ACTIONS.map((action) => (
            <MarkButton key={action.label} action={action} editor={editor} />
          ))}
        </div>
      </BubbleMenu>
      <BubbleMenu
        editor={editor}
        className="z-20"
        pluginKey="blockTypeBubbleMenu"
        shouldShow={hasCaretWithoutSelection}
        options={{ placement: "top-start", offset: 8 }}
        getReferencedVirtualElement={() => caretBlockVirtualElement()}
      >
        <div
          role="toolbar"
          aria-label="نوع بلوک متن"
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          <BlockTypeMenu editor={editor} />
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} className="prose" />
    </Tiptap>
  );
}
