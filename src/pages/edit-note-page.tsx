import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotes } from "@/hooks/use-notes";
import {
  BODY_MAX,
  TITLE_MAX,
  validateNote,
  type NoteErrors,
} from "@/lib/note-schema";
import type { NewNote, Note } from "@/lib/notes";

const INITIAL_ERRORS: NoteErrors = {};
const NOT_FOUND_MESSAGE = "یادداشت یافت نشد";
const SAVE_FAILED_MESSAGE = "ذخیره یادداشت ناموفق بود";
const GONE_MESSAGE = "این یادداشت حذف شده است";

type EditNoteFormProps = {
  note: Note;
  /** Resolves to null when the note was deleted elsewhere. */
  onSave: (id: number, note: NewNote) => Promise<Note | null>;
};

export function EditNotePage() {
  const { id } = useParams<{ id: string }>();
  const { notes, isLoading, error, update } = useNotes();

  const page = (
    <div className="flex w-full flex-col gap-6 p-6">
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری…
        </p>
      ) : (
        <NotFound />
      )}
    </div>
  );

  if (error !== null || isLoading) return page;

  const noteId = Number(id);
  const note = Number.isInteger(noteId)
    ? notes.find((candidate) => candidate.id === noteId)
    : undefined;

  if (note === undefined) return page;

  // key forces fresh form state when navigating straight from one note's editor
  // to another's, which a plain remount would not catch.
  return <EditNoteForm key={note.id} note={note} onSave={update} />;
}

function NotFound() {
  return (
    <>
      <p className="text-sm text-muted-foreground">{NOT_FOUND_MESSAGE}</p>
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/">بازگشت</Link>
        </Button>
      </div>
    </>
  );
}

function EditNoteForm({ note, onSave }: EditNoteFormProps) {
  const navigate = useNavigate();

  // Seeded from the note, which is why this is a separate component: the
  // container only renders it once the note has arrived.
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [errors, setErrors] = useState<NoteErrors>(INITIAL_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Re-validate a field only once it is already showing an error, so the
  // message clears as soon as the input becomes valid without nagging while
  // the user is still typing.
  function revalidate(
    field: keyof NoteErrors,
    value: { title: string; body: string },
  ) {
    setErrors((current) => {
      if (current[field] === undefined) return current;

      const { errors: next } = validateNote(value);
      return { ...current, [field]: next[field] };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { data, errors: validationErrors } = validateNote({ title, body });

    if (data === undefined) {
      setErrors(validationErrors);
      return;
    }

    setErrors(INITIAL_ERRORS);
    setIsSaving(true);
    try {
      const updated = await onSave(note.id, data);

      // The row is gone, most likely deleted from another window. Stay put and
      // say so rather than navigating to a list that no longer has it.
      if (updated === null) {
        setFormError(GONE_MESSAGE);
        return;
      }

      navigate("/");
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : SAVE_FAILED_MESSAGE,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        {/* RTL: the logical "back" arrow points right. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="icon" aria-label="بازگشت">
              <Link to="/">
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">بازگشت</TooltipContent>
        </Tooltip>
        <h1 className="font-heading text-2xl font-bold">ویرایش یادداشت</h1>
      </header>

      {/* noValidate: zod owns the messages, the browser's are English. */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <FieldGroup>
          <Field data-invalid={errors.title !== undefined}>
            <FieldLabel htmlFor="title">عنوان</FieldLabel>
            <Input
              id="title"
              name="title"
              autoFocus
              value={title}
              maxLength={TITLE_MAX}
              onChange={(event) => {
                const value = event.target.value;
                setTitle(value);
                revalidate("title", { title: value, body });
              }}
              aria-invalid={errors.title !== undefined}
              aria-describedby={
                errors.title !== undefined
                  ? "title-error title-count"
                  : "title-count"
              }
            />
            <FieldDescription id="title-count">
              <CharacterCount value={title} max={TITLE_MAX} />
            </FieldDescription>
            <FieldError id="title-error">{errors.title}</FieldError>
          </Field>

          <Field data-invalid={errors.body !== undefined}>
            <FieldLabel htmlFor="body">متن</FieldLabel>
            <Textarea
              id="body"
              name="body"
              value={body}
              rows={16}
              maxLength={BODY_MAX}
              onChange={(event) => {
                const value = event.target.value;
                setBody(value);
                revalidate("body", { title, body: value });
              }}
              aria-invalid={errors.body !== undefined}
              aria-describedby="body-hint"
              className="max-h-[40vh] min-h-[40vh] resize-y"
            />
            <FieldDescription id="body-hint">
              اختیاری — <CharacterCount value={body} max={BODY_MAX} />
            </FieldDescription>
            <FieldError>{errors.body}</FieldError>
          </Field>
        </FieldGroup>

        {formError !== null && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        {/*
         * justify-end puts the group on the left in RTL. A plain gap-2 row would
         * pack it against the start edge, which is the right.
         */}
        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline" disabled={isSaving}>
            <Link to="/">انصراف</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "در حال ذخیره..." : "ذخیره"}
          </Button>
        </div>
      </form>
    </div>
  );
}
