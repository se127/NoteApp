import { z } from "zod";

/**
 * Validation for note creation and editing.
 *
 * The title is always required; the body is optional but length-capped. Runs in
 * the renderer for instant feedback; electron/db.mjs re-checks the same limits
 * in the main process, because the renderer is untrusted and IPC can be invoked
 * by anything with access to the preload bridge.
 */
export const TITLE_MAX = 120;
export const BODY_MAX = 5000;

export const noteSchema = z.object({
  // .trim() runs before .min(), so a whitespace-only title is rejected.
  title: z
    .string()
    .trim()
    .min(1, "عنوان یادداشت الزامی است")
    .max(TITLE_MAX, `عنوان نباید بیشتر از ${TITLE_MAX} کاراکتر باشد`),
  body: z
    .string()
    .trim()
    .max(BODY_MAX, `متن نباید بیشتر از ${BODY_MAX} کاراکتر باشد`),
});

export type NoteInput = z.infer<typeof noteSchema>;

/** Field-keyed messages, ready to hand to <FieldError>. */
export type NoteErrors = Partial<Record<keyof NoteInput, string>>;

export function validateNote(input: { title: string; body: string }): {
  data?: NoteInput;
  errors: NoteErrors;
} {
  const result = noteSchema.safeParse(input);

  if (result.success) {
    return { data: result.data, errors: {} };
  }

  const errors: NoteErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof NoteInput] = issue.message;
    }
  }

  return { errors };
}
