import { Loader2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink } from "react-router";

import { NoteActionsMenu } from "@/components/note-actions-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { noteTitle } from "@/lib/note-title";
import {
  formatAbsoluteTime,
  formatRelativeTime,
  hasBeenEdited,
} from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export const LIST_LABEL = "یادداشت ها";
const TITLE_HEADING = "عنوان";
const CREATED_HEADING = "زمان ایجاد";
const ACTIONS_HEADING = "گزینه ها";
const EDITED_LABEL = "ویرایش شده:";
const TITLE_COLUMN = "w-1/2";
const CREATED_COLUMN = "w-1/4";
const ACTIONS_COLUMN = "w-1/4";
const TABLE_WIDTH = "w-full table-fixed";
const CHECKBOX_LABEL = "انتخاب یادداشت";
const HEAD_CELL =
  "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]";
const HEAD_ROW = "[&_tr]:border-0!";
const ROW_ESTIMATED_HEIGHT = 48;
const ROW_OVERSCAN = 8;
const COLUMN_COUNT = 3;
const NEAR_END_ROWS = 3;
const LOADER_LABEL = "در حال بارگذاری یادداشت های بیشتر...";
const LOADER_CELL = "py-4 text-center text-sm text-muted-foreground";
const LIST_SCROLLER =
  "h-full overflow-auto [&>[data-slot=table-container]]:overflow-x-visible";

type NotesTableProps = {
  notes: Note[];
  isSelecting: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
};

export function NotesTable({
  notes,
  isSelecting,
  selectedIds,
  onToggleSelect,
}: NotesTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { hasMore, isLoadingMore, listScrollTop, loadMore } = useNotesStore();

  useLayoutEffect(() => {
    setHeaderHeight(headerRef.current?.offsetHeight ?? 0);
  }, []);

  const getItemKey = useCallback(
    (index: number) => notes[index]?.id ?? index,
    [notes],
  );

  // oxlint-disable-next-line react/incompatible-library -- the rows come from the virtualizer's own mutable state, so this component must stay un-memoized
  const rows = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize: () => ROW_ESTIMATED_HEIGHT,
    overscan: ROW_OVERSCAN,
    scrollMargin: headerHeight,
    initialOffset: listScrollTop.current,
  });

  const handleScroll = useCallback(() => {
    listScrollTop.current = scrollRef.current?.scrollTop ?? 0;
  }, [listScrollTop]);

  const items = rows.getVirtualItems();
  const lastItem = items.at(-1);
  const lastIndex = lastItem?.index;

  useEffect(() => {
    if (lastIndex === undefined || !hasMore || isLoadingMore) return;
    if (lastIndex < notes.length - NEAR_END_ROWS) return;

    void loadMore();
  }, [hasMore, isLoadingMore, lastIndex, loadMore, notes.length]);

  return (
    <div
      ref={scrollRef}
      data-virtual-scroll
      onScroll={handleScroll}
      className={LIST_SCROLLER}
    >
      <Table aria-label={LIST_LABEL} className={TABLE_WIDTH}>
        <TableHeader ref={headerRef} className={HEAD_ROW}>
          <TableRow>
            <TableHead className={cn(TITLE_COLUMN, HEAD_CELL)}>
              {TITLE_HEADING}
            </TableHead>
            <TableHead className={cn(CREATED_COLUMN, "text-center", HEAD_CELL)}>
              {CREATED_HEADING}
            </TableHead>
            <TableHead className={cn(ACTIONS_COLUMN, HEAD_CELL)}>
              <span className="sr-only">{ACTIONS_HEADING}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items[0] !== undefined && (
            <SpacerRow height={items[0].start - headerHeight} />
          )}
          {items.map((row) => {
            const note = notes[row.index];

            return (
              <NoteTableRow
                key={row.key}
                note={note}
                index={row.index}
                measure={rows.measureElement}
                isSelecting={isSelecting}
                isSelected={selectedIds.includes(note.id)}
                onToggleSelect={onToggleSelect}
              />
            );
          })}
          {lastItem !== undefined && (
            <SpacerRow
              height={rows.getTotalSize() - headerHeight - lastItem.end}
            />
          )}
          {isLoadingMore && <LoaderRow />}
        </TableBody>
      </Table>
    </div>
  );
}

function LoaderRow() {
  return (
    <TableRow data-loading-more>
      <TableCell colSpan={COLUMN_COUNT} className={LOADER_CELL}>
        <span
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2"
        >
          <Loader2 className="size-4 animate-spin" />
          {LOADER_LABEL}
        </span>
      </TableCell>
    </TableRow>
  );
}

function SpacerRow({ height }: { height: number }) {
  if (height <= 0) return null;

  return (
    <TableRow aria-hidden style={{ height, border: 0 }}>
      <TableCell colSpan={COLUMN_COUNT} style={{ padding: 0 }} />
    </TableRow>
  );
}

function NoteTableRow({
  note,
  index,
  measure,
  isSelecting,
  isSelected,
  onToggleSelect,
}: {
  note: Note;
  index: number;
  measure: (node: HTMLTableRowElement | null) => void;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const { isSaving } = useNotesStore();

  const title = noteTitle(note);
  const wasEdited = hasBeenEdited(note.createdAt, note.updatedAt);
  const titleColor =
    note.title.trim() === "" ? "text-muted-foreground" : undefined;

  return (
    <TableRow ref={measure} data-index={index}>
      <TableCell
        className={cn("relative align-top whitespace-normal", TITLE_COLUMN)}
      >
        {isSelecting ? (
          <div className="flex items-start gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(note.id)}
              aria-label={`${CHECKBOX_LABEL} ${title}`}
              className="mt-1"
            />
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggleSelect(note.id)}
              className={cn(
                "block flex-1 text-start break-words outline-none focus-visible:underline",
                titleColor,
              )}
            >
              {title}
            </button>
          </div>
        ) : (
          <NavLink
            to={`/notes/${note.id}/edit`}
            aria-disabled={isSaving}
            className={cn(
              "block break-words outline-none after:absolute after:inset-0 focus-visible:underline",
              titleColor,
              isSaving && "pointer-events-none",
            )}
          >
            {title}
          </NavLink>
        )}

        {wasEdited && (
          <Tooltip>
            <TooltipTrigger asChild>
              <time
                dateTime={note.updatedAt}
                className="relative z-10 mt-1 block w-fit cursor-default text-xs text-muted-foreground"
              >
                {`${EDITED_LABEL} ${formatRelativeTime(note.updatedAt)}`}
              </time>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {formatAbsoluteTime(note.updatedAt)}
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>

      <TableCell
        className={cn(
          "text-center align-top text-muted-foreground",
          CREATED_COLUMN,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <time className="cursor-default">
              {formatRelativeTime(note.createdAt)}
            </time>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {formatAbsoluteTime(note.createdAt)}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      <TableCell className={cn("text-end align-top", ACTIONS_COLUMN)}>
        <NoteActionsMenu note={note} disabled={isSaving} />
      </TableCell>
    </TableRow>
  );
}
