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
import {
  FontSize,
  LineHeight,
  Color,
  TextStyle,
} from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import {
  Baseline,
  Bold,
  Check,
  Code2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  PilcrowLeft,
  PilcrowRight,
  Quote,
  Redo2,
  Smile,
  Square,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Type as TypeIcon,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import {
  TextSelection,
  type Selection as EditorSelection,
} from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmojiGrid } from "@/components/emoji-grid";
import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { ToolbarMenu, type ToolbarMenuOption } from "@/components/toolbar-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type ToolbarCommand, toolbarShortcut } from "@/lib/shortcuts";
import {
  findToolbarCommand,
  runToolbarCommand,
  useToolbarCommand,
} from "@/lib/toolbar-commands";
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
  CODE_BLOCK_LANGUAGES,
  CodeBlock,
  activeCodeBlockLanguage,
  setCodeBlockLanguage,
} from "@/lib/code-block";
import {
  FONT_SIZES,
  MIXED_FONT_SIZE_LABEL,
  NO_FONT_SIZE_OFFERED,
  activeFontSize,
  applyFontSize,
  isFontSizeValue,
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
    code: false,
    codeBlock: false,
    heading: { levels: [...HEADING_LEVELS] },
    link: false,
    trailingNode: false,
  }),
  Subscript,
  Superscript,
  TextAlign.configure({ types: ALIGNABLE_TYPES }),
  TextDirectionExtension,
  TextStyle,
  Color,
  FontSize,
  LineHeight,
  Highlight.configure({ multicolor: true }),
  CodeBlock,
  Placeholder.configure({ placeholder: BODY_PLACEHOLDER }),
];

export type BodyEditor = Editor;

type MarkAction = {
  command: ToolbarCommand;
  label: string;
  icon: LucideIcon;
  isActive: (editor: BodyEditor) => boolean;
  toggle: (editor: BodyEditor) => void;
  disablesOnHeading?: boolean;
};

const MARK_ACTIONS: MarkAction[] = [
  {
    command: "bold",
    label: "ضخیم",
    icon: Bold,
    isActive: (editor) => editor.isActive("bold"),
    toggle: (editor) => editor.chain().focus().toggleBold().run(),
    disablesOnHeading: true,
  },
  {
    command: "italic",
    label: "مورب",
    icon: Italic,
    isActive: (editor) => editor.isActive("italic"),
    toggle: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    command: "underline",
    label: "زیرخط",
    icon: UnderlineIcon,
    isActive: (editor) => editor.isActive("underline"),
    toggle: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    command: "strike",
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
  const shortcut = toolbarShortcut(action.command);

  const run = useCallback(() => action.toggle(editor), [action, editor]);

  useToolbarCommand(action.command, run);

  return (
    <ShortcutTooltip shortcut={shortcut}>
      <Button
        variant={isActive ? "default" : "ghost"}
        size="icon-sm"
        aria-label={action.label}
        aria-pressed={isActive}
        disabled={isDisabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={run}
        className={cn(
          "rounded-md",
          !isActive &&
            "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
        )}
      >
        <Icon className="size-4" />
      </Button>
    </ShortcutTooltip>
  );
}

type HistoryAction = {
  command: ToolbarCommand;
  label: string;
  icon: LucideIcon;
  isAvailable: (editor: BodyEditor) => boolean;
  run: (editor: BodyEditor) => void;
};

const HISTORY_ACTIONS: HistoryAction[] = [
  {
    command: "undo",
    label: "برگرداندن",
    icon: Undo2,
    isAvailable: (editor) => editor.can().undo(),
    run: (editor) => editor.chain().focus().undo().run(),
  },
  {
    command: "redo",
    label: "بازگرداندن",
    icon: Redo2,
    isAvailable: (editor) => editor.can().redo(),
    run: (editor) => editor.chain().focus().redo().run(),
  },
];

function HistoryButton({
  action,
  editor,
}: {
  action: HistoryAction;
  editor: BodyEditor;
}) {
  const Icon = action.icon;
  const isAvailable = useEditorState({
    editor,
    selector: ({ editor: instance }) => action.isAvailable(instance),
  });
  const shortcut = toolbarShortcut(action.command);

  const run = useCallback(() => action.run(editor), [action, editor]);

  useToolbarCommand(action.command, run);

  return (
    <ShortcutTooltip shortcut={shortcut}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={action.label}
        disabled={!isAvailable}
        onMouseDown={(event) => event.preventDefault()}
        onClick={run}
        className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Icon className="size-4" />
      </Button>
    </ShortcutTooltip>
  );
}

const COLOR_PALETTE = [
  "#000000",
  "#262626",
  "#404040",
  "#595959",
  "#737373",
  "#8c8c8c",
  "#a6a6a6",
  "#bfbfbf",
  "#d9d9d9",
  "#ffffff",
  "#7f1d1d",
  "#991b1b",
  "#b91c1c",
  "#dc2626",
  "#ef4444",
  "#f87171",
  "#fca5a5",
  "#fecaca",
  "#fee2e2",
  "#fef2f2",
  "#7c2d12",
  "#9a3412",
  "#c2410c",
  "#ea580c",
  "#f97316",
  "#fb923c",
  "#fdba74",
  "#fed7aa",
  "#ffedd5",
  "#fff7ed",
  "#14532d",
  "#166534",
  "#15803d",
  "#16a34a",
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#bbf7d0",
  "#dcfce7",
  "#f0fdf4",
  "#1e3a8a",
  "#1e40af",
  "#1d4ed8",
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#dbeafe",
  "#eff6ff",
  "#581c87",
  "#6b21a8",
  "#7e22ce",
  "#9333ea",
  "#a855f7",
  "#c084fc",
  "#d8b4fe",
  "#e9d5ff",
  "#f3e8ff",
  "#fdf4ff",
];

const DEFAULT_HIGHLIGHT_COLOR = "#fef08a";

type ColorAction = {
  command: ToolbarCommand;
  label: string;
  icon: LucideIcon;
  idleColor: string;
  getColor: (editor: BodyEditor) => string | undefined;
  setColor: (editor: BodyEditor, color: string) => void;
  unsetColor: (editor: BodyEditor) => void;
};

const COLOR_ACTIONS: ColorAction[] = [
  {
    command: "textColor",
    label: "رنگ متن",
    icon: TypeIcon,
    idleColor: "currentColor",
    getColor: (editor) =>
      editor.getAttributes("textStyle").color as string | undefined,
    setColor: (editor, color) => {
      editor.chain().focus().setColor(color).run();
    },
    unsetColor: (editor) => {
      editor.chain().focus().unsetColor().run();
    },
  },
  {
    command: "highlightColor",
    label: "رنگ پس زمینه",
    icon: Highlighter,
    idleColor: DEFAULT_HIGHLIGHT_COLOR,
    getColor: (editor) =>
      editor.getAttributes("highlight").color as string | undefined,
    setColor: (editor, color) => {
      editor.chain().focus().setHighlight({ color }).run();
    },
    unsetColor: (editor) => {
      editor.chain().focus().unsetHighlight().run();
    },
  },
];

function ColorSwatch({
  color,
  isSelected,
  onSelect,
}: {
  color: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={color}
      aria-label={color}
      aria-pressed={isSelected}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "size-5 rounded-sm transition-shadow hover:ring-2 hover:ring-foreground hover:ring-offset-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isSelected && "ring-2 ring-foreground ring-offset-1",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function ColorPicker({
  action,
  editor,
}: {
  action: ColorAction;
  editor: BodyEditor;
}) {
  const Icon = action.icon;
  const color = useEditorState({
    editor,
    selector: ({ editor: instance }) => action.getColor(instance),
  });
  const { saveSelection, restoreSelection } = useSavedSelection(editor);
  const [open, setOpen] = useState(false);
  const shortcut = toolbarShortcut(action.command);

  const run = useCallback(() => {
    saveSelection();
    setOpen(true);
  }, [saveSelection]);

  useToolbarCommand(action.command, run);

  return (
    <div className="relative flex">
      <ShortcutTooltip shortcut={shortcut} open={open ? false : undefined}>
        <div className="flex">
          <DropdownMenu
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (next) saveSelection();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={action.label}
                onPointerDown={saveSelection}
                onMouseDown={(event) => event.preventDefault()}
                className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="flex flex-col items-center justify-center gap-0.5">
                  <Icon className="size-3.5" />
                  <span
                    className="h-0.5 w-4 rounded-full"
                    style={{ backgroundColor: color ?? action.idleColor }}
                  />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                restoreSelection();
              }}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="justify-center"
                  onSelect={() => action.unsetColor(editor)}
                >
                  <span className="relative size-4">
                    <Square className="size-4" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-full w-0.5 rotate-45 bg-destructive" />
                    </span>
                  </span>
                  پیش فرض
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-10 gap-1 p-2">
                {COLOR_PALETTE.map((swatch) => (
                  <ColorSwatch
                    key={swatch}
                    color={swatch}
                    isSelected={swatch === color}
                    onSelect={() => {
                      action.setColor(editor, swatch);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ShortcutTooltip>
    </div>
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
  const shortcut = toolbarShortcut("blockType");

  const run = useCallback(() => {
    saveSelection();
    setIsListOpen(true);
  }, [saveSelection]);

  useToolbarCommand("blockType", run);

  return (
    <ShortcutTooltip shortcut={shortcut} open={isListOpen ? false : undefined}>
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
            aria-label={shortcut.label}
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
    </ShortcutTooltip>
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
      command="textAlign"
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
      command="textPosition"
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
      command="textDirection"
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
  const shortcut = toolbarShortcut("bodyEmoji");

  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);

  useToolbarCommand("bodyEmoji", toggle);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ShortcutTooltip shortcut={shortcut} open={open ? false : undefined}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={shortcut.label}
            onMouseDown={(event) => event.preventDefault()}
            className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Smile className="size-4" />
          </Button>
        </PopoverTrigger>
      </ShortcutTooltip>

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

function CodeBlockButton({ editor }: { editor: BodyEditor }) {
  const language = useEditorState({
    editor,
    selector: ({ editor: instance }) => activeCodeBlockLanguage(instance),
  });
  const { saveSelection, restoreSelection } = useSavedSelection(editor);
  const [open, setOpen] = useState(false);
  const shortcut = toolbarShortcut("codeBlock");

  const run = useCallback(() => {
    saveSelection();
    setOpen(true);
  }, [saveSelection]);

  useToolbarCommand("codeBlock", run);

  return (
    <ShortcutTooltip shortcut={shortcut} open={open ? false : undefined}>
      <div className="flex">
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) saveSelection();
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant={language === null ? "ghost" : "default"}
              size="icon-sm"
              aria-label={shortcut.label}
              aria-pressed={language !== null}
              onPointerDown={saveSelection}
              onMouseDown={(event) => event.preventDefault()}
              className={cn(
                "rounded-md",
                language === null &&
                  "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              <Code2 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreSelection();
            }}
          >
            <DropdownMenuGroup className="max-h-48 overflow-y-auto">
              {CODE_BLOCK_LANGUAGES.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => {
                    setCodeBlockLanguage(editor, option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                  {language === option.value ? (
                    <Check className="ms-auto size-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ShortcutTooltip>
  );
}

function BlockquoteButton({ editor }: { editor: BodyEditor }) {
  const isActive = useEditorState({
    editor,
    selector: ({ editor: instance }) => instance.isActive("blockquote"),
  });
  const shortcut = toolbarShortcut("blockquote");

  const run = useCallback(
    () => editor.chain().focus().toggleBlockquote().run(),
    [editor],
  );

  useToolbarCommand("blockquote", run);

  return (
    <ShortcutTooltip shortcut={shortcut}>
      <Button
        variant={isActive ? "default" : "ghost"}
        size="icon-sm"
        aria-label={shortcut.label}
        aria-pressed={isActive}
        onMouseDown={(event) => event.preventDefault()}
        onClick={run}
        className={cn(
          "rounded-md",
          !isActive &&
            "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
        )}
      >
        <Quote className="size-4" />
      </Button>
    </ShortcutTooltip>
  );
}

function HorizontalRuleButton({ editor }: { editor: BodyEditor }) {
  const shortcut = toolbarShortcut("horizontalRule");

  const run = useCallback(
    () => editor.chain().focus().setHorizontalRule().run(),
    [editor],
  );

  useToolbarCommand("horizontalRule", run);

  return (
    <ShortcutTooltip shortcut={shortcut}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={shortcut.label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={run}
        className="rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Minus className="size-4" />
      </Button>
    </ShortcutTooltip>
  );
}

type ListKind = "bulletList" | "orderedList";

function toggleList(editor: BodyEditor, kind: ListKind): void {
  const chain = editor.chain().focus();

  if (kind === "bulletList") chain.toggleBulletList().run();
  else chain.toggleOrderedList().run();
}

type ListAction = {
  command: ToolbarCommand;
  label: string;
  icon: LucideIcon;
  isActive: (editor: BodyEditor) => boolean;
  toggle: (editor: BodyEditor) => void;
};

const LIST_ACTIONS: ListAction[] = [
  {
    command: "bulletList",
    label: "لیست نقطه ای",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    toggle: (editor) => toggleList(editor, "bulletList"),
  },
  {
    command: "orderedList",
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
  const shortcut = toolbarShortcut(action.command);

  const run = useCallback(() => action.toggle(editor), [action, editor]);

  useToolbarCommand(action.command, run);

  return (
    <ShortcutTooltip shortcut={shortcut} open={isHeading ? false : undefined}>
      <Button
        variant={isActive ? "default" : "ghost"}
        size="icon-sm"
        aria-label={action.label}
        aria-pressed={isActive}
        disabled={isHeading}
        onMouseDown={(event) => event.preventDefault()}
        onClick={run}
        className={cn(
          "rounded-md",
          !isActive &&
            "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
        )}
      >
        <Icon className="size-4" />
      </Button>
    </ShortcutTooltip>
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
  const label =
    FONT_SIZES.find((size) => size.value === value)?.label ??
    MIXED_FONT_SIZE_LABEL;
  const { saveSelection, restoreSelection } = useSavedSelection(editor);
  const [isListOpen, setIsListOpen] = useState(false);
  const shortcut = toolbarShortcut("fontSize");

  const run = useCallback(() => {
    saveSelection();
    setIsListOpen(true);
  }, [saveSelection]);

  useToolbarCommand("fontSize", run);

  return (
    <div className="relative flex">
      <ShortcutTooltip
        shortcut={shortcut}
        open={isListOpen || isHeading ? false : undefined}
      >
        <div className="flex">
          <Select
            value={value ?? NO_FONT_SIZE_OFFERED}
            open={isListOpen}
            disabled={isHeading}
            onOpenChange={(open) => {
              setIsListOpen(open);
              onOpenChange?.(open);
            }}
            onValueChange={(next) => {
              if (isFontSizeValue(next)) applyFontSize(editor, next);
            }}
          >
            <SelectTrigger
              aria-label={shortcut.label}
              onPointerDown={saveSelection}
              onMouseDown={(event) => event.preventDefault()}
              className="h-7 w-20 items-center rounded-md bg-background px-2 py-0 text-sm text-foreground hover:bg-background disabled:opacity-50 dark:bg-input/30"
            >
              <SelectValue>{label}</SelectValue>
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
      </ShortcutTooltip>
    </div>
  );
}

const EDITABLE_SELECTOR = "input, textarea, [contenteditable]";

function editsAnotherField(event: KeyboardEvent, editor: BodyEditor): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (editor.view.dom.contains(target)) return false;
  return target.closest(EDITABLE_SELECTOR) !== null;
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

  useEffect(() => {
    if (editor === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const command = findToolbarCommand(event);
      if (command === undefined) return;
      if (editsAnotherField(event, editor)) return;

      event.preventDefault();
      runToolbarCommand(command);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editor]);

  if (editor === null) return null;

  return (
    <Tiptap editor={editor}>
      <div
        role="toolbar"
        aria-label="قالب بندی متن"
        className="flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-2 border-y border-border bg-black/5 px-6 py-2 dark:bg-muted/40"
      >
        {HISTORY_ACTIONS.map((action) => (
          <HistoryButton key={action.label} action={action} editor={editor} />
        ))}
        <Separator orientation="vertical" className="mx-0.5" />
        <TextDirectionMenu editor={editor} />
        <BlockTypeMenu editor={editor} />
        <Separator orientation="vertical" className="mx-0.5" />
        <FontSizePicker editor={editor} />
        {MARK_ACTIONS.map((action) => (
          <MarkButton key={action.label} action={action} editor={editor} />
        ))}
        {COLOR_ACTIONS.map((action) => (
          <ColorPicker key={action.label} action={action} editor={editor} />
        ))}
        <Separator orientation="vertical" className="mx-0.5" />
        {LIST_ACTIONS.map((action) => (
          <ListButton key={action.label} action={action} editor={editor} />
        ))}
        <Separator orientation="vertical" className="mx-0.5" />
        <TextAlignMenu editor={editor} />
        <TextPositionMenu editor={editor} />
        <Separator orientation="vertical" className="mx-0.5" />
        <CodeBlockButton editor={editor} />
        <BlockquoteButton editor={editor} />
        <HorizontalRuleButton editor={editor} />
        <Separator orientation="vertical" className="mx-0.5" />
        <BodyEmojiPicker editor={editor} />
      </div>
      <div className="note-body mt-4 flex min-h-0 flex-1 flex-col overflow-hidden px-6">
        <div data-note-scroll="" className="min-h-0 flex-1 overflow-y-auto">
          <div>
            <EditorContent editor={editor} className="prose" />
          </div>
        </div>
      </div>
    </Tiptap>
  );
}
