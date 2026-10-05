import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function OverflowingTitle({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;

    const measure = () => {
      const overflow = viewport.scrollWidth - viewport.offsetWidth;
      if (overflow <= 1) {
        setOffset(null);
        return;
      }
      const isRtl = getComputedStyle(viewport).direction === "rtl";
      setOffset(isRtl ? overflow : -overflow);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [children]);

  const isScrolling = isHovered && offset !== null;

  return (
    <span
      ref={viewportRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      className={cn(
        "block flex-1 overflow-hidden p-2",
        isScrolling ? "whitespace-nowrap" : "truncate",
        className,
      )}
    >
      <span
        className={cn(
          isScrolling && "inline-block max-w-none animate-note-title-scroll",
        )}
        style={
          isScrolling
            ? ({ "--scroll-offset": `${offset}px` } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
