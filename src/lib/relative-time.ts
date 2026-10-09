import dayjs from "dayjs";

const MISSING_VALUE = "—";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DAYS_IN_MONTH = 30;
const MONTHS_IN_YEAR = 12;
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const DATE_FORMATTER = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DATE_TIME_SEPARATOR = " ، ";
const IN_PREFIX = "در ";
const AGO_SUFFIX = " ی پیش";

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function toPersianDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function parseSqliteTimestamp(value: string): dayjs.Dayjs {
  const iso = value.trim().replace(" ", "T");
  return dayjs(iso.endsWith("Z") ? iso : `${iso}Z`);
}

function elapsedParts(
  elapsed: number,
  months: number,
): {
  count: number;
  unit: string;
} {
  if (elapsed < MINUTE) {
    return { count: Math.floor(elapsed / SECOND), unit: "ثانیه" };
  }
  if (elapsed < HOUR) {
    return { count: Math.floor(elapsed / MINUTE), unit: "دقیقه" };
  }
  if (elapsed < DAY) {
    return { count: Math.floor(elapsed / HOUR), unit: "ساعت" };
  }
  if (elapsed < DAYS_IN_MONTH * DAY) {
    return { count: Math.floor(elapsed / DAY), unit: "روز" };
  }
  if (months < MONTHS_IN_YEAR) {
    return { count: months, unit: "ماه" };
  }
  return { count: Math.floor(months / MONTHS_IN_YEAR), unit: "سال" };
}

export function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  if (!date.isValid()) return MISSING_VALUE;

  const now = dayjs();
  const isFuture = date.isAfter(now);
  const { count, unit } = elapsedParts(
    Math.abs(date.diff(now)),
    Math.abs(date.diff(now, "month")),
  );
  const elapsed = `${toPersianDigits(count)} ${unit}`;

  return isFuture ? `${IN_PREFIX}${elapsed}` : `${elapsed}${AGO_SUFFIX}`;
}

export function hasBeenEdited(createdAt: string, updatedAt: string): boolean {
  const created = parseSqliteTimestamp(createdAt);
  const updated = parseSqliteTimestamp(updatedAt);

  if (!created.isValid() || !updated.isValid()) {
    return updatedAt.trim() !== "" && updatedAt.trim() !== createdAt.trim();
  }

  return updated.valueOf() !== created.valueOf();
}

export function formatAbsoluteTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  if (!date.isValid()) return MISSING_VALUE;

  const instant = date.toDate();
  const parts = DATE_FORMATTER.formatToParts(instant);
  const day = partValue(parts, "day");
  const month = partValue(parts, "month");
  const year = partValue(parts, "year");
  const weekday = partValue(parts, "weekday");

  return `${weekday} ${day} ${month} ${year}${DATE_TIME_SEPARATOR}${TIME_FORMATTER.format(instant)}`;
}
