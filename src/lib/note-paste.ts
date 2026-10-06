import { Fragment, Slice } from "@tiptap/pm/model";

export function keepPastedTextInline(slice: Slice): Slice {
  if (slice.content.childCount !== 1) return slice;

  const child = slice.content.firstChild;
  if (child === null || !child.isTextblock) return slice;

  return new Slice(Fragment.from(child.content), 0, 0);
}
