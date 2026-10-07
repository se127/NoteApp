export type Shortcut = {
  key: string;
  combination: string;
  label: string;
  description: string;
};

export const NEW_NOTE_SHORTCUT: Shortcut = {
  key: "n",
  combination: "Ctrl + N",
  label: "یادداشت جدید",
  description: "یادداشت تازه‌ ای می‌ سازد و ویرایشگر آن را باز می‌کند.",
};

export const SAVE_NOTE_SHORTCUT: Shortcut = {
  key: "s",
  combination: "Ctrl + S",
  label: "ذخیره ی یادداشت فعلی",
  description:
    "یادداشت را بی‌ درنگ ذخیره می‌کند و ذخیره خودکار معطل را لغو می‌کند.",
};

export const SHORTCUTS: readonly Shortcut[] = [
  NEW_NOTE_SHORTCUT,
  SAVE_NOTE_SHORTCUT,
];

export type ShortcutKeys = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey"
>;

export function isShortcut(event: ShortcutKeys, key: string): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false;
  if (event.altKey) return false;
  if (event.code === `Key${key.toUpperCase()}`) return true;
  return event.key.toLowerCase() === key;
}
