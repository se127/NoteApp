import type { Mark } from "@tiptap/pm/model";

import type { BodyEditor } from "@/components/note-body-editor";

export const FONT_SIZES = [
  {
    label: "14px",
    value: "sm",
    fontSize: "var(--text-sm)",
    lineHeight: "var(--text-sm--line-height)",
  },
  {
    label: "16px",
    value: "base",
    fontSize: "var(--text-base)",
    lineHeight: "var(--text-base--line-height)",
  },
  {
    label: "18px",
    value: "lg",
    fontSize: "var(--text-lg)",
    lineHeight: "var(--text-lg--line-height)",
  },
  {
    label: "20px",
    value: "xl",
    fontSize: "var(--text-xl)",
    lineHeight: "var(--text-xl--line-height)",
  },
  {
    label: "24px",
    value: "2xl",
    fontSize: "var(--text-2xl)",
    lineHeight: "var(--text-2xl--line-height)",
  },
] as const;

export type FontSizeValue = (typeof FONT_SIZES)[number]["value"];

export const DEFAULT_FONT_SIZE: FontSizeValue = "sm";

export const FONT_SIZE_LABEL = "اندازه ی متن";

export const MIXED_FONT_SIZE_LABEL = "متنوع";

export const NO_FONT_SIZE_OFFERED = "mixed";

const TEXT_STYLE_MARK = "textStyle";

export type CarriedFontSize = FontSizeValue | null;

function carriedFontSize(fontSize: unknown): CarriedFontSize {
  if (fontSize === undefined || fontSize === null) return DEFAULT_FONT_SIZE;
  return FONT_SIZES.find((size) => size.fontSize === fontSize)?.value ?? null;
}

function fontSizeOfMarks(marks: readonly Mark[]): unknown {
  return marks.find((mark) => mark.type.name === TEXT_STYLE_MARK)?.attrs
    .fontSize;
}

export function activeFontSize(editor: BodyEditor): CarriedFontSize {
  const { selection, doc, storedMarks } = editor.state;

  if (selection.empty) {
    return carriedFontSize(
      fontSizeOfMarks(storedMarks ?? selection.$from.marks()),
    );
  }

  const carried = new Set<unknown>();
  doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.isText) carried.add(fontSizeOfMarks(node.marks));
  });

  const values = [...carried].map(carriedFontSize);
  const [first, ...rest] = values;
  if (first === undefined) return DEFAULT_FONT_SIZE;
  return rest.every((value) => value === first) ? first : null;
}

export function fontSizeRange(editor: BodyEditor): {
  from: number;
  to: number;
} {
  const { selection } = editor.state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  const $from = selection.$from;
  if ($from.depth === 0) return { from: selection.from, to: selection.to };
  return { from: $from.start($from.depth), to: $from.end($from.depth) };
}

export function isFontSizeValue(value: string): value is FontSizeValue {
  return FONT_SIZES.some((size) => size.value === value);
}

export function applyFontSize(editor: BodyEditor, value: FontSizeValue): void {
  const size = FONT_SIZES.find((candidate) => candidate.value === value);
  if (size === undefined) return;
  editor
    .chain()
    .focus()
    .setFontSize(size.fontSize)
    .setLineHeight(size.lineHeight)
    .run();
}
