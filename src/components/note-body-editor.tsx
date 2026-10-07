import { Placeholder } from "@tiptap/extensions";
import {
  EditorContent,
  Tiptap,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { FontSize, LineHeight, TextStyle } from "@tiptap/extension-text-style";
import {
  Baseline,
  Bold,
  Italic,
  List,
  ListOrdered,
  PilcrowLeft,
  PilcrowRight,
  Smile,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import {
  TextSelection,
  type Selection as EditorSelection,
} from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";

import { EmojiGrid } from "@/components/emoji-grid";
import { ToolbarMenu, type ToolbarMenuOption } from "@/components/toolbar-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { bodyToHtml } from "@/lib/note-body";
import { keepPastedTextInline } from "@/lib/note-paste";
import {
  BLOCK_TYPES,
  HEADING_LEVELS,
  activeBlockType,
  isHeadingBlock,
  setBlockType,
} from "@/lib/block-type";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_LABEL,
  FONT_SIZES,
  type FontSizeValue,
} from "@/lib/font-size";
import {
  TextDirectionExtension,
  type TextDirection,
} from "@/lib/text-direction";
import { cn } from "@/lib/utils";

const BODY_PLACEHOLDER = "متن یادداشت را اینجا بنویسید...";

const ALIGNABLE_TYPES = ["paragraph", "heading"];

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: { levels: [...HEADING_LEVELS] },
    horizontalRule: false,
    link: false,
    trailingNode: false,
  }),
  Subscript,
  Superscript,
  TextAlign.configure({ types: ALIGNABLE_TYPES }),
  TextDirectionExtension,
  TextStyle,
  FontSize,
  LineHeight,
  Placeholder.configure({ placeholder: BODY_PLACEHOLDER }),
];

export type BodyEditor = Editor;

type MarkAction = {
  label: string;
  icon: LucideIcon;
  isActive: (editor: BodyEditor) => boolean;
  toggle: (editor: BodyEditor) => void;
  disablesOnHeading?: boolean;
};

const MARK_ACTIONS: MarkAction[] = [
  {
    label: "ضخیم",
    icon: Bold,
    isActive: (editor) => editor.isActive("bold"),
    toggle: (editor) => editor.chain().focus().toggleBold().run(),
    disablesOnHeading: true,
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

type MarkButtonProps = {
  action: MarkAction;
  editor: BodyEditor;
};

function MarkButton({ action, editor }: MarkButtonProps) {
  const Icon = action.icon;
  const isActive = useEditorState({
    editor,
    selector: ({ editor: instance }) => action.isActive(instance),
  });
  const isDisabled = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      action.disablesOnHeading === true && isHeadingBlock(instance),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="icon-sm"
          aria-label={action.label}
          aria-pressed={isActive}
          disabled={isDisabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => action.toggle(editor)}
          className={cn(
            "rounded-md",
            !isActive &&
              "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
          )}
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
  const TriggerIcon = blockType.icon;
  const { saveSelection, restoreSelection } = useSavedSelection(editor);
  const [isListOpen, setIsListOpen] = useState(false);

  return (
    <Tooltip open={isListOpen ? false : undefined}>
      <TooltipTrigger asChild>
        <div className="flex">
          <Select
            value={blockType.label}
            open={isListOpen}
            onOpenChange={setIsListOpen}
            onValueChange={(label) => {
              const type = BLOCK_TYPES.find(
                (candidate) => candidate.label === label,
              );
              if (type !== undefined) setBlockType(editor, type);
            }}
          >
            <SelectTrigger
              aria-label="سبک متن"
              onPointerDown={saveSelection}
              onMouseDown={(event) => event.preventDefault()}
              className="h-7 w-32 items-center rounded-md bg-background px-2 py-0 text-sm text-foreground hover:bg-background dark:bg-input/30"
            >
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <TriggerIcon className="size-4" />
                  {blockType.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="min-w-32"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                restoreSelection();
              }}
            >
              {BLOCK_TYPES.map((type) => {
                const ItemIcon = type.icon;
                return (
                  <SelectItem key={type.label} value={type.label}>
                    <span className="flex items-center gap-1.5">
                      <ItemIcon className="size-4" />
                      {type.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">سبک متن</TooltipContent>
    </Tooltip>
  );
}

type TextAlignment = "left" | "center" | "right" | "justify";

const ALIGNMENTS: ToolbarMenuOption<TextAlignment>[] = [
  { value: "right", label: "راست", icon: TextAlignEnd },
  { value: "center", label: "وسط", icon: TextAlignCenter },
  { value: "left", label: "چپ", icon: TextAlignStart },
  { value: "justify", label: "هم تراز", icon: TextAlignJustify },
];

function activeAlignment(editor: BodyEditor): TextAlignment {
  return (
    ALIGNMENTS.find(({ value }) => editor.isActive({ textAlign: value }))
      ?.value ?? "right"
  );
}

function TextAlignMenu({ editor }: { editor: BodyEditor }) {
  const alignment = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeAlignment(instance),
  });
  const active = ALIGNMENTS.find(({ value }) => value === alignment);

  return (
    <ToolbarMenu
      label="تراز متن"
      triggerLabel="تراز متن"
      options={ALIGNMENTS}
      activeValue={alignment}
      triggerIcon={active?.icon ?? TextAlignStart}
      onSelect={(value) => {
        const chain = editor.chain().focus();
        if (value === alignment) chain.unsetTextAlign().run();
        else chain.setTextAlign(value).run();
      }}
    />
  );
}

type TextPosition = "normal" | "subscript" | "superscript";

const TEXT_POSITIONS: ToolbarMenuOption<TextPosition>[] = [
  { value: "normal", label: "معمولی", icon: Baseline },
  { value: "subscript", label: "زیرنویس", icon: SubscriptIcon },
  { value: "superscript", label: "بالانویس", icon: SuperscriptIcon },
];

function activeTextPosition(editor: BodyEditor): TextPosition {
  if (editor.isActive("subscript")) return "subscript";
  if (editor.isActive("superscript")) return "superscript";
  return "normal";
}

function setTextPosition(editor: BodyEditor, position: TextPosition): void {
  const chain = editor.chain().focus().unsetSubscript().unsetSuperscript();

  if (position === "subscript") chain.setSubscript().run();
  else if (position === "superscript") chain.setSuperscript().run();
  else chain.run();
}

function TextPositionMenu({ editor }: { editor: BodyEditor }) {
  const position = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeTextPosition(instance),
  });
  const active = TEXT_POSITIONS.find(({ value }) => value === position);

  return (
    <ToolbarMenu
      label="موقعیت متن"
      triggerLabel="موقعیت متن"
      options={TEXT_POSITIONS}
      activeValue={position}
      triggerIcon={active?.icon ?? Baseline}
      onSelect={(value) => setTextPosition(editor, value)}
    />
  );
}

const TEXT_DIRECTIONS: ToolbarMenuOption<TextDirection>[] = [
  { value: "rtl", label: "راست به چپ", icon: PilcrowLeft },
  { value: "ltr", label: "چپ به راست", icon: PilcrowRight },
];

function directionIcon(direction: TextDirection): LucideIcon {
  return (
    TEXT_DIRECTIONS.find(({ value }) => value === direction)?.icon ??
    PilcrowLeft
  );
}

function activeTextDirection(editor: BodyEditor): TextDirection {
  return (
    TEXT_DIRECTIONS.find(({ value }) => editor.isActive({ dir: value }))
      ?.value ?? "rtl"
  );
}

function TextDirectionMenu({ editor }: { editor: BodyEditor }) {
  const direction = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeTextDirection(instance),
  });

  return (
    <ToolbarMenu
      label="جهت متن"
      triggerLabel="جهت متن"
      options={TEXT_DIRECTIONS}
      activeValue={direction}
      triggerIcon={directionIcon(direction)}
      onSelect={(value) => {
        const chain = editor.chain().focus();
        if (value === direction) chain.unsetBlockDirection().run();
        else chain.setBlockDirection(value).run();
      }}
    />
  );
}

function BodyEmojiPicker({ editor }: { editor: BodyEditor }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="انتخاب ایموجی"
              onMouseDown={(event) => event.preventDefault()}
              className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Smile className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">انتخاب ایموجی</TooltipContent>
      </Tooltip>

      <PopoverContent
        side="bottom"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        className="w-auto gap-0 p-1"
      >
        <EmojiGrid
          onSelect={(emoji) => {
            editor.chain().focus().insertContent(emoji).run();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type ListKind = "bulletList" | "orderedList";

function toggleList(editor: BodyEditor, kind: ListKind): void {
  const chain = editor.chain().focus();

  if (kind === "bulletList") chain.toggleBulletList().run();
  else chain.toggleOrderedList().run();
}

type ListAction = {
  label: string;
  icon: LucideIcon;
  isActive: (editor: BodyEditor) => boolean;
  toggle: (editor: BodyEditor) => void;
};

const LIST_ACTIONS: ListAction[] = [
  {
    label: "لیست نقطه ای",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    toggle: (editor) => toggleList(editor, "bulletList"),
  },
  {
    label: "لیست شماره دار",
    icon: ListOrdered,
    isActive: (editor) => editor.isActive("orderedList"),
    toggle: (editor) => toggleList(editor, "orderedList"),
  },
];

function ListButton({ action, editor }: MarkButtonProps) {
  const Icon = action.icon;
  const isActive = useEditorState({
    editor,
    selector: ({ editor: instance }) => action.isActive(instance),
  });
  const isHeading = useEditorState({
    editor,
    selector: ({ editor: instance }) => isHeadingBlock(instance),
  });

  return (
    <Tooltip open={isHeading ? false : undefined}>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="icon-sm"
          aria-label={action.label}
          aria-pressed={isActive}
          disabled={isHeading}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => action.toggle(editor)}
          className={cn(
            "rounded-md",
            !isActive &&
              "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
          )}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{action.label}</TooltipContent>
    </Tooltip>
  );
}

function activeFontSize(editor: BodyEditor): FontSizeValue {
  const stored =
    editor.state.storedMarks ?? editor.state.selection.$from.marks();
  const storedFontSize = stored.find((mark) => mark.type.name === "textStyle")
    ?.attrs.fontSize;
  const { fontSize } = editor.getAttributes("textStyle");

  return (
    FONT_SIZES.find((size) => size.fontSize === fontSize)?.value ??
    FONT_SIZES.find((size) => size.fontSize === storedFontSize)?.value ??
    DEFAULT_FONT_SIZE
  );
}

function clampedSelection(
  editor: BodyEditor,
  saved: EditorSelection,
): TextSelection {
  const { doc } = editor.state;
  return TextSelection.create(
    doc,
    Math.min(saved.anchor, doc.content.size),
    Math.min(saved.head, doc.content.size),
  );
}

function useSavedSelection(editor: BodyEditor) {
  const savedSelection = useRef<EditorSelection | null>(null);

  const saveSelection = () => {
    savedSelection.current = editor.state.selection;
  };

  const restoreSelection = () => {
    const saved = savedSelection.current;
    savedSelection.current = null;
    if (saved === null) return;
    const pendingMarks = editor.state.storedMarks;
    const transaction = editor.state.tr.setSelection(
      clampedSelection(editor, saved),
    );
    if (pendingMarks !== null && pendingMarks !== undefined) {
      transaction.setStoredMarks(pendingMarks);
    }
    editor.view.focus();
    editor.view.dispatch(transaction);
  };

  return { saveSelection, restoreSelection };
}

function FontSizePicker({
  editor,
  onOpenChange,
}: {
  editor: BodyEditor;
  onOpenChange?: (open: boolean) => void;
}) {
  const value = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeFontSize(instance),
  });
  const isHeading = useEditorState({
    editor,
    selector: ({ editor: instance }) => isHeadingBlock(instance),
  });
  const active =
    FONT_SIZES.find((size) => size.value === value) ?? FONT_SIZES[0];
  const { saveSelection, restoreSelection } = useSavedSelection(editor);
  const [isListOpen, setIsListOpen] = useState(false);

  return (
    <div className="relative flex">
      <Tooltip open={isListOpen || isHeading ? false : undefined}>
        <TooltipTrigger asChild>
          <div className="flex">
            <Select
              value={value}
              open={isListOpen}
              disabled={isHeading}
              onOpenChange={(open) => {
                setIsListOpen(open);
                onOpenChange?.(open);
              }}
              onValueChange={(next) => {
                const size = FONT_SIZES.find((item) => item.value === next);
                if (size === undefined) return;
                editor
                  .chain()
                  .focus()
                  .setFontSize(size.fontSize)
                  .setLineHeight(size.lineHeight)
                  .run();
              }}
            >
              <SelectTrigger
                aria-label={FONT_SIZE_LABEL}
                onPointerDown={saveSelection}
                onMouseDown={(event) => event.preventDefault()}
                className="h-7 w-20 items-center rounded-md bg-background px-2 py-0 text-sm text-foreground hover:bg-background disabled:opacity-50 dark:bg-input/30"
              >
                <SelectValue>{active.label}</SelectValue>
              </SelectTrigger>
              <SelectContent
                className="min-w-24"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  restoreSelection();
                }}
              >
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{FONT_SIZE_LABEL}</TooltipContent>
      </Tooltip>
    </div>
  );
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
      <div
        role="toolbar"
        aria-label="قالب‌بندی متن"
        className="flex shrink-0 flex-wrap items-center gap-0.5 rounded-lg border border-border bg-black/5 p-1 dark:bg-muted/40"
      >
        <TextDirectionMenu editor={editor} />
        <BlockTypeMenu editor={editor} />
        <Separator orientation="vertical" className="mx-0.5" />
        <FontSizePicker editor={editor} />
        {MARK_ACTIONS.map((action) => (
          <MarkButton key={action.label} action={action} editor={editor} />
        ))}
        <Separator orientation="vertical" className="mx-0.5" />
        {LIST_ACTIONS.map((action) => (
          <ListButton key={action.label} action={action} editor={editor} />
        ))}
        <Separator orientation="vertical" className="mx-0.5" />
        <TextAlignMenu editor={editor} />
        <TextPositionMenu editor={editor} />
        <Separator orientation="vertical" className="mx-0.5" />
        <BodyEmojiPicker editor={editor} />
      </div>
      <div
        data-note-scroll=""
        className="note-body mt-4 min-h-0 flex-1 scrollbar-thin overflow-y-auto"
      >
        <EditorContent editor={editor} className="prose" />
      </div>
    </Tiptap>
  );
}
