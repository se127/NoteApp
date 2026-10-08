import {
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Pilcrow,
  type LucideIcon,
} from "lucide-react";

import type { BodyEditor } from "@/components/note-body-editor";
import { fontSizeRange } from "@/lib/font-size";

export const HEADING_LEVELS = [2, 3, 4, 5, 6] as const;

export type BlockType = {
  label: string;
  level: (typeof HEADING_LEVELS)[number] | null;
  icon: LucideIcon;
};

export const BLOCK_TYPES: BlockType[] = [
  { label: "پاراگراف", level: null, icon: Pilcrow },
  { label: "عنوان ۲", level: 2, icon: Heading2 },
  { label: "عنوان ۳", level: 3, icon: Heading3 },
  { label: "عنوان ۴", level: 4, icon: Heading4 },
  { label: "عنوان ۵", level: 5, icon: Heading5 },
  { label: "عنوان ۶", level: 6, icon: Heading6 },
];

export function activeBlockType(editor: BodyEditor): BlockType {
  const level = HEADING_LEVELS.find((candidate) =>
    editor.isActive("heading", { level: candidate }),
  );

  return BLOCK_TYPES.find((type) => type.level === level) ?? BLOCK_TYPES[0];
}

export function setBlockType(editor: BodyEditor, blockType: BlockType): void {
  const saved = editor.state.selection;
  const chain = editor.chain().focus();

  if (blockType.level === null) {
    chain.setParagraph();
  } else {
    chain
      .setTextSelection(fontSizeRange(editor))
      .setHeading({ level: blockType.level })
      .unsetFontSize()
      .unsetLineHeight();
  }

  chain.setTextSelection(saved).run();
}

export function isHeadingBlock(editor: BodyEditor): boolean {
  return HEADING_LEVELS.some((level) => editor.isActive("heading", { level }));
}
