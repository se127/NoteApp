import { Extension } from "@tiptap/core";

export type TextDirection = "ltr" | "rtl";

export const TEXT_DIRECTIONS = ["ltr", "rtl"] as const;

const DIRECTABLE_TYPES = ["paragraph", "heading"];

function isTextDirection(value: unknown): value is TextDirection {
  return TEXT_DIRECTIONS.includes(value as TextDirection);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textDirection: {
      setBlockDirection: (direction: TextDirection) => ReturnType;
      unsetBlockDirection: () => ReturnType;
    };
  }
}

export const TextDirectionExtension = Extension.create({
  name: "blockDirection",

  addGlobalAttributes() {
    return [
      {
        types: DIRECTABLE_TYPES,
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute("dir");
              return isTextDirection(value) ? value : null;
            },
            renderHTML: (attributes) =>
              attributes.dir === null ? {} : { dir: attributes.dir },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockDirection:
        (direction) =>
        ({ commands }) =>
          DIRECTABLE_TYPES.map((type) =>
            commands.updateAttributes(type, { dir: direction }),
          ).some(Boolean),
      unsetBlockDirection:
        () =>
        ({ commands }) =>
          DIRECTABLE_TYPES.map((type) =>
            commands.resetAttributes(type, "dir"),
          ).some(Boolean),
    };
  },
});
