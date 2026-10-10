export type Shortcut = {
  alt?: boolean;
  code: string;
  combination: string;
  description: string;
  key: string;
  label: string;
  shift?: boolean;
  tooltipLabel?: string;
};

export type ToolbarCommand =
  | "blockType"
  | "blockquote"
  | "bodyEmoji"
  | "bold"
  | "bulletList"
  | "codeBlock"
  | "fontSize"
  | "highlightColor"
  | "horizontalRule"
  | "italic"
  | "orderedList"
  | "redo"
  | "strike"
  | "textAlign"
  | "textColor"
  | "textDirection"
  | "textPosition"
  | "underline"
  | "undo";

export type ToolbarShortcut = {
  command: ToolbarCommand;
  shortcut: Shortcut;
};

export const NEW_NOTE_SHORTCUT: Shortcut = {
  code: "KeyN",
  combination: "Ctrl + N",
  description: "یادداشت تازه ای می سازد و ویرایشگر آن را باز می کند.",
  key: "n",
  label: "یادداشت جدید",
};

export const BACK_TO_NOTES_SHORTCUT: Shortcut = {
  code: "KeyL",
  combination: "Ctrl + L",
  description:
    "یادداشت فعلی را بی درنگ ذخیره می کند و به فهرست یادداشت ها بر می گردد.",
  key: "l",
  label: "بازگشت به یادداشت ها",
};

export const SAVE_NOTE_SHORTCUT: Shortcut = {
  code: "KeyS",
  combination: "Ctrl + S",
  description:
    "یادداشت را بی درنگ ذخیره می کند و ذخیره خودکار معطل را لغو می کند.",
  key: "s",
  label: "ذخیره ی یادداشت فعلی",
};

export const SELECT_MODE_SHORTCUT: Shortcut = {
  code: "KeyE",
  combination: "Ctrl + Shift + E",
  description:
    "حالت انتخاب را روشن یا خاموش می کند و کنار عنوان هر یادداشت یک چک باکس می آورد.",
  key: "e",
  label: "حالت انتخاب برای یادداشت ها",
  shift: true,
};

export const NOTE_ACTIONS_SHORTCUT: Shortcut = {
  code: "KeyM",
  combination: "Ctrl + Shift + M",
  description: "فهرست گزینه های یادداشت فعلی را باز می کند.",
  key: "m",
  label: "گزینه های یادداشت فعلی",
  shift: true,
  tooltipLabel: "گزینه ها",
};

export const DELETE_SELECTED_SHORTCUT: Shortcut = {
  alt: true,
  code: "KeyS",
  combination: "Ctrl + Alt + S",
  description:
    "همه ی یادداشت های انتخاب شده را با یک پرسش پیش از حذف پاک می کند.",
  key: "s",
  label: "حذف یادداشت های انتخاب شده",
};

export const THEME_SHORTCUT: Shortcut = {
  code: "KeyP",
  combination: "Ctrl + Shift + P",
  description: "فهرست پوسته ی روشن ، تاریک یا پیروی از سیستم را باز می کند.",
  key: "p",
  label: "تغییر پوسته",
  shift: true,
};

export const ACCENT_SHORTCUT: Shortcut = {
  code: "KeyA",
  combination: "Ctrl + Shift + A",
  description: "فهرست رنگ برنامه را باز می کند تا رنگ دلخواه را انتخاب کنید.",
  key: "a",
  label: "تغییر رنگ",
  shift: true,
};

export const SHORTCUTS_DIALOG_SHORTCUT: Shortcut = {
  code: "KeyK",
  combination: "Ctrl + Shift + K",
  description: "همین فهرست را باز می کند و با زدن دوباره می بندد.",
  key: "k",
  label: "کلیدهای میان بر",
  shift: true,
};

export const TITLE_EMOJI_SHORTCUT: Shortcut = {
  alt: true,
  code: "KeyG",
  combination: "Ctrl + Alt + G",
  description:
    "انتخابگر ایموجی عنوان را از هر جایی باز می کند و با زدن دوباره می بندد.",
  key: "g",
  label: "انتخاب ایموجی",
};

export const TOOLBAR_SHORTCUTS: readonly ToolbarShortcut[] = [
  {
    command: "undo",
    shortcut: {
      code: "KeyZ",
      combination: "Ctrl + Z",
      description: "آخرین تغییر متن یادداشت را بر می گرداند.",
      key: "z",
      label: "برگرداندن",
    },
  },
  {
    command: "redo",
    shortcut: {
      code: "KeyY",
      combination: "Ctrl + Y",
      description: "تغییری را که برگردانده اید دوباره اجرا می کند.",
      key: "y",
      label: "بازگرداندن",
    },
  },
  {
    command: "textDirection",
    shortcut: {
      alt: true,
      code: "KeyD",
      combination: "Ctrl + Alt + D",
      description: "فهرست جهت متن را باز می کند.",
      key: "d",
      label: "جهت متن",
    },
  },
  {
    command: "blockType",
    shortcut: {
      alt: true,
      code: "KeyT",
      combination: "Ctrl + Alt + T",
      description: "فهرست سبک متن را باز می کند.",
      key: "t",
      label: "سبک متن",
    },
  },
  {
    command: "fontSize",
    shortcut: {
      alt: true,
      code: "KeyF",
      combination: "Ctrl + Alt + F",
      description: "فهرست اندازه ی متن را باز می کند.",
      key: "f",
      label: "اندازه ی متن",
    },
  },
  {
    command: "bold",
    shortcut: {
      code: "KeyB",
      combination: "Ctrl + B",
      description: "متن انتخابی را ضخیم می کند.",
      key: "b",
      label: "ضخیم",
    },
  },
  {
    command: "italic",
    shortcut: {
      code: "KeyI",
      combination: "Ctrl + I",
      description: "متن انتخابی را مورب می کند.",
      key: "i",
      label: "مورب",
    },
  },
  {
    command: "underline",
    shortcut: {
      code: "KeyU",
      combination: "Ctrl + U",
      description: "متن انتخابی را زیرخط می کند.",
      key: "u",
      label: "زیرخط",
    },
  },
  {
    command: "strike",
    shortcut: {
      code: "KeyX",
      combination: "Ctrl + Shift + X",
      description: "متن انتخابی را خط خورده می کند.",
      key: "x",
      label: "خط خورده",
      shift: true,
    },
  },
  {
    command: "textColor",
    shortcut: {
      alt: true,
      code: "KeyC",
      combination: "Ctrl + Alt + C",
      description: "فهرست رنگ متن را باز می کند.",
      key: "c",
      label: "رنگ متن",
    },
  },
  {
    command: "highlightColor",
    shortcut: {
      alt: true,
      code: "KeyH",
      combination: "Ctrl + Alt + H",
      description: "فهرست رنگ پس زمینه را باز می کند.",
      key: "h",
      label: "رنگ پس زمینه",
    },
  },
  {
    command: "bulletList",
    shortcut: {
      code: "KeyU",
      combination: "Ctrl + Shift + U",
      description: "بلوک فعلی را به فهرست نقطه ای تبدیل می کند.",
      key: "u",
      label: "لیست نقطه ای",
      shift: true,
    },
  },
  {
    command: "orderedList",
    shortcut: {
      code: "KeyO",
      combination: "Ctrl + Shift + O",
      description: "بلوک فعلی را به فهرست شماره دار تبدیل می کند.",
      key: "o",
      label: "لیست شماره دار",
      shift: true,
    },
  },
  {
    command: "textAlign",
    shortcut: {
      alt: true,
      code: "KeyA",
      combination: "Ctrl + Alt + A",
      description: "فهرست تراز متن را باز می کند.",
      key: "a",
      label: "تراز متن",
    },
  },
  {
    command: "textPosition",
    shortcut: {
      alt: true,
      code: "KeyP",
      combination: "Ctrl + Alt + P",
      description:
        "فهرست موقعیت متن را باز می کند تا متن را معمولی ، زیرنویس یا بالانویس کنید.",
      key: "p",
      label: "موقعیت متن",
    },
  },
  {
    command: "codeBlock",
    shortcut: {
      alt: true,
      code: "KeyK",
      combination: "Ctrl + Alt + K",
      description:
        "فهرست زبان های بلوک کد را باز می کند تا کد ساده یا کد هایلایت دار درج کنید.",
      key: "k",
      label: "بلاک کد",
    },
  },
  {
    command: "blockquote",
    shortcut: {
      code: "KeyQ",
      combination: "Ctrl + Shift + Q",
      description: "بلوک فعلی را داخل نقل قول می برد.",
      key: "q",
      label: "نقل قول",
      shift: true,
    },
  },
  {
    command: "horizontalRule",
    shortcut: {
      code: "KeyH",
      combination: "Ctrl + Shift + H",
      description: "زیر بلوک فعلی یک خط افقی می گذارد.",
      key: "h",
      label: "خط افقی",
      shift: true,
    },
  },
  {
    command: "bodyEmoji",
    shortcut: {
      alt: true,
      code: "KeyE",
      combination: "Ctrl + Alt + E",
      description: "انتخابگر ایموجی را برای متن یادداشت باز می کند.",
      key: "e",
      label: "انتخاب ایموجی",
    },
  },
];

const SHORTCUT_BY_COMMAND = new Map(
  TOOLBAR_SHORTCUTS.map((entry) => [entry.command, entry.shortcut]),
);

export function toolbarShortcut(command: ToolbarCommand): Shortcut {
  const shortcut = SHORTCUT_BY_COMMAND.get(command);
  if (shortcut === undefined) {
    throw new Error(`no shortcut is bound to the ${command} toolbar command`);
  }
  return shortcut;
}

export const SHORTCUT_GROUPS: readonly {
  heading: string;
  shortcuts: readonly Shortcut[];
}[] = [
  {
    heading: "برنامه",
    shortcuts: [THEME_SHORTCUT, ACCENT_SHORTCUT, SHORTCUTS_DIALOG_SHORTCUT],
  },
  {
    heading: "صفحه ی اصلی",
    shortcuts: [
      NEW_NOTE_SHORTCUT,
      SELECT_MODE_SHORTCUT,
      DELETE_SELECTED_SHORTCUT,
    ],
  },
  {
    heading: "یادداشت",
    shortcuts: [
      SAVE_NOTE_SHORTCUT,
      BACK_TO_NOTES_SHORTCUT,
      NOTE_ACTIONS_SHORTCUT,
    ],
  },
  {
    heading: "عنوان یادداشت",
    shortcuts: [TITLE_EMOJI_SHORTCUT],
  },
  {
    heading: "متن یادداشت",
    shortcuts: TOOLBAR_SHORTCUTS.map((entry) => entry.shortcut),
  },
];

export const SHORTCUTS: readonly Shortcut[] = SHORTCUT_GROUPS.flatMap(
  ({ shortcuts }) => shortcuts,
);

export type ShortcutKeys = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

function matchesPhysicalKey(event: ShortcutKeys, shortcut: Shortcut): boolean {
  if (event.code === shortcut.code) return true;
  return event.key.toLowerCase() === shortcut.key.toLowerCase();
}

export function isShortcut(event: ShortcutKeys, shortcut: Shortcut): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false;
  if (event.altKey !== (shortcut.alt ?? false)) return false;
  if (event.shiftKey !== (shortcut.shift ?? false)) return false;
  return matchesPhysicalKey(event, shortcut);
}
