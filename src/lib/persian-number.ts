const PERSIAN_NUMBER_FORMAT = new Intl.NumberFormat("fa-IR");

export function formatPersianNumber(value: number): string {
  if (value < 0) return `-${PERSIAN_NUMBER_FORMAT.format(-value)}`;
  return PERSIAN_NUMBER_FORMAT.format(value);
}
