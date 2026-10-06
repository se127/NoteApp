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
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";

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

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: false,
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
      <EditorContent editor={editor} className="prose" />
    </Tiptap>
  );
}
