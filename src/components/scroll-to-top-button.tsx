import { ArrowUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const REVEAL_DISTANCE = 24;

export function ScrollToTopButton({
  anchorRef,
}: {
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    setScroller(anchorRef.current?.closest("main") ?? null);
  }, [anchorRef]);

  useEffect(() => {
    if (scroller === null) return;

    const sync = () => setIsScrolledDown(scroller.scrollTop > REVEAL_DISTANCE);
    sync();

    scroller.addEventListener("scroll", sync, { passive: true });
    return () => scroller.removeEventListener("scroll", sync);
  }, [scroller]);

  return (
    <div
      className={cn(
        "fixed bottom-4 left-6 z-10 transition-all duration-300 ease-out",
        isScrolledDown
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="رفتن به بالا"
            tabIndex={isScrolledDown ? 0 : -1}
            onClick={() => scroller?.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">رفتن به بالا</TooltipContent>
      </Tooltip>
    </div>
  );
}
