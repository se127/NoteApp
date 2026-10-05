import { Smile } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";

const LABEL = "انتخاب ایموجی";

export function TitleEmojiPicker({
  onSelect,
  open,
  onOpenChange,
}: {
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = open;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip open={isHovered && !isOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={LABEL}
              onMouseDown={(event) => event.preventDefault()}
              onPointerEnter={() => setIsHovered(true)}
              onPointerLeave={() => setIsHovered(false)}
              className="bg-popover text-muted-foreground"
            >
              <Smile />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{LABEL}</TooltipContent>
      </Tooltip>

      <PopoverContent
        side="bottom"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        className="w-auto gap-0 p-1"
      >
        <div
          role="grid"
          aria-label={LABEL}
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
      </PopoverContent>
    </Popover>
  );
}
