type CharacterCountProps = {
  value: string;
  max: number;
};

/**
 * Live "characters remaining" readout for a length-capped field.
 *
 * Counts the raw value, which is what maxLength enforces on the input, so the
 * readout can never disagree with what the browser will actually accept. It is
 * plain text rather than an aria-live region: a region that changes on every
 * keystroke would interrupt a screen reader mid-sentence. The field links to it
 * via aria-describedby instead.
 */
export function CharacterCount({ value, max }: CharacterCountProps) {
  const remaining = max - value.length;

  return (
    <span className={remaining < 0 ? "text-destructive" : undefined}>
      {remaining.toLocaleString("fa-IR")} از {max.toLocaleString("fa-IR")}{" "}
      کاراکتر باقی مانده
    </span>
  );
}
