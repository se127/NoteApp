import { Smile } from "lucide-react";

import { EMOJI_LABEL, EmojiGrid } from "@/components/emoji-grid";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutTooltip } from "@/components/shortcut-tooltip";
import { TITLE_EMOJI_SHORTCUT } from "@/lib/shortcuts";

const LABEL = EMOJI_LABEL;

export function TitleEmojiPicker({
  onSelect,
  open,
  onOpenChange,
}: {
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <ShortcutTooltip
        shortcut={TITLE_EMOJI_SHORTCUT}
        side="bottom"
        open={open ? false : undefined}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={LABEL}
            onMouseDown={(event) => event.preventDefault()}
            className="bg-popover text-foreground"
          >
            <Smile />
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
        <EmojiGrid onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}
