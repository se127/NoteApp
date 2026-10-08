import { Ellipsis, Inbox, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";

import { OverflowingTitle } from "@/components/overflowing-title";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Note } from "@/lib/notes";
import { useNotesStore } from "@/lib/notes-store";
import { isShortcut, NEW_NOTE_SHORTCUT } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

const EMPTY_MESSAGE = "هیچ یادداشتی نیست";
const LIST_LABEL = "یادداشت‌ها";
const DELETE_FAILED_MESSAGE = "حذف یادداشت ناموفق بود";
const CREATE_FAILED_MESSAGE = "ساخت یادداشت ناموفق بود";

export function AppSidebar() {
  const navigate = useNavigate();
  const { notes, isLoading, error, create, isSaving } = useNotesStore();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleNewNote = useCallback(async () => {
    if (isCreating || isSaving) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const note = await create({ title: "", body: "" });
      navigate(`/notes/${note.id}/edit`);
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : CREATE_FAILED_MESSAGE,
      );
    } finally {
      setIsCreating(false);
    }
  }, [create, isCreating, isSaving, navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event, NEW_NOTE_SHORTCUT)) return;

      event.preventDefault();
      void handleNewNote();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleNewNote]);

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-e border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <ShortcutsDialog />
        <ThemeToggle />
      </div>

      <div className="px-3 py-3">
        <Button
          className="w-full"
          onClick={handleNewNote}
          disabled={isCreating || isSaving}
        >
          <Plus className="size-4" />
          {isCreating ? "در حال ساخت..." : "یادداشت جدید"}
        </Button>
        {createError !== null && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {createError}
          </p>
        )}
      </div>

      <nav
        aria-label={LIST_LABEL}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بارگذاری...
          </p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
            <Inbox className="size-6" />
            <p className="text-sm">{EMPTY_MESSAGE}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function NoteRow({ note }: { note: Note }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { remove, isSaving } = useNotesStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await remove(note.id);
      setDeleteError(null);
      setIsDialogOpen(false);
      if (location.pathname === `/notes/${note.id}/edit`) {
        navigate("/");
      }
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : DELETE_FAILED_MESSAGE,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const noteTitle = note.title.trim() === "" ? "بدون عنوان" : note.title;

  return (
    <li>
      <NavLink
        to={`/notes/${note.id}/edit`}
        aria-disabled={isSaving}
        className={({ isActive }) =>
          cn(
            "group flex w-full items-center gap-1 rounded-md text-sm text-sidebar-foreground transition-colors outline-none focus-visible:bg-sidebar-accent-strong focus-visible:text-sidebar-accent-foreground",
            isSaving && "pointer-events-none",
            isActive
              ? "bg-sidebar-accent-strong font-medium text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent-strong hover:text-sidebar-accent-foreground",
          )
        }
      >
        <OverflowingTitle
          className={cn(note.title.trim() === "" && "text-muted-foreground")}
        >
          {noteTitle}
        </OverflowingTitle>

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <Tooltip open={isHovered && !isMenuOpen}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`گزینه‌های یادداشت ${noteTitle}`}
                  disabled={isSaving}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerEnter={() => setIsHovered(true)}
                  onPointerLeave={() => setIsHovered(false)}
                  className={cn(
                    "me-1 shrink-0 transition-opacity",
                    isMenuOpen
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">گزینه‌ها</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="left"
            align="center"
            onFocusOutside={(event) => event.preventDefault()}
          >
            <DropdownMenuItem
              variant="destructive"
              onClick={(event) => event.stopPropagation()}
              onSelect={(event) => {
                event.preventDefault();
                setDeleteError(null);
                setIsDialogOpen(true);
              }}
            >
              <Trash2 />
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavLink>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              آیا از حذف این یادداشت مطمئن هستید؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{noteTitle}» برای همیشه حذف می‌شود و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>انصراف</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "در حال حذف..." : "بله"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
