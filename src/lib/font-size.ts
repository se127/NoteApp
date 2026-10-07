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
