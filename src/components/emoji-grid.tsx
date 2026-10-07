import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";

export const EMOJI_LABEL = "انتخاب ایموجی";

export function EmojiGrid({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div
      role="grid"
      aria-label={EMOJI_LABEL}
      onMouseDown={(event) => event.preventDefault()}
      className="grid grid-cols-8 gap-0.5"
    >
      {FREQUENT_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="gridcell"
          aria-label={emoji}
          onClick={() => onSelect(emoji)}
          className="grid size-8 place-items-center rounded-md text-lg transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
