import dayjs from "dayjs";

import type { Note } from "@/lib/notes";
import { formatPersianNumber } from "@/lib/persian-number";

export type SortDirection = "asc" | "desc";

const MISSING_VALUE = "—";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DAYS_IN_MONTH = 30;
const MONTHS_IN_YEAR = 12;
const JUST_NOW_BELOW = 10 * SECOND;
const JUST_NOW = "همین الان";
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
const AGO_SUFFIX = " پیش";
const EZAFE = " ی";

function agoLabel(count: number, unit: string, ezafe: boolean): string {
  const label = `${formatPersianNumber(count)} ${unit}`;
  return `${label}${ezafe ? EZAFE : ""}${AGO_SUFFIX}`;
}

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function parseSqliteTimestamp(value: string): dayjs.Dayjs {
  const iso = value.trim().replace(" ", "T");
  return dayjs(iso.endsWith("Z") ? iso : `${iso}Z`);
}

type Elapsed =
  | { justNow: true }
  | { justNow: false; count: number; unit: string; ezafe: boolean };

function elapsedParts(elapsed: number): Elapsed {
  if (elapsed < JUST_NOW_BELOW) return { justNow: true };

  if (elapsed < MINUTE) {
    return {
      justNow: false,
      count: Math.floor(elapsed / SECOND),
      unit: "ثانیه",
      ezafe: true,
    };
  }
  if (elapsed < HOUR) {
    return {
      justNow: false,
      count: Math.floor(elapsed / MINUTE),
      unit: "دقیقه",
      ezafe: true,
    };
  }
  if (elapsed < DAY) {
    return {
      justNow: false,
      count: Math.floor(elapsed / HOUR),
      unit: "ساعت",
      ezafe: false,
    };
  }

  const months = Math.floor(elapsed / (DAYS_IN_MONTH * DAY));
  if (months < 1) {
    return {
      justNow: false,
      count: Math.floor(elapsed / DAY),
      unit: "روز",
      ezafe: false,
    };
  }
  if (months < MONTHS_IN_YEAR) {
    return { justNow: false, count: months, unit: "ماه", ezafe: false };
  }
  return {
    justNow: false,
    count: Math.floor(months / MONTHS_IN_YEAR),
    unit: "سال",
    ezafe: false,
  };
}

export function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  if (!date.isValid()) return MISSING_VALUE;

  const now = dayjs();
  const isFuture = date.isAfter(now);
  const elapsed = elapsedParts(Math.abs(date.diff(now)));

  if (elapsed.justNow) return JUST_NOW;
  if (isFuture)
    return `${IN_PREFIX}${formatPersianNumber(elapsed.count)} ${elapsed.unit}`;
  return agoLabel(elapsed.count, elapsed.unit, elapsed.ezafe);
}

export function hasBeenEdited(createdAt: string, updatedAt: string): boolean {
  const created = parseSqliteTimestamp(createdAt);
  const updated = parseSqliteTimestamp(updatedAt);

  if (!created.isValid() || !updated.isValid()) {
    return updatedAt.trim() !== "" && updatedAt.trim() !== createdAt.trim();
  }

  return updated.valueOf() !== created.valueOf();
}

function createdValue(note: Note): number {
  const created = parseSqliteTimestamp(note.createdAt);
  return created.isValid() ? created.valueOf() : Number.NaN;
}

export function sortNotesByCreatedAt(
  notes: Note[],
  direction: SortDirection,
): Note[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...notes].sort((first, second) => {
    const difference = createdValue(first) - createdValue(second);

    return (
      (Number.isNaN(difference) ? 0 : difference * factor) ||
      (first.id - second.id) * factor
    );
  });
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
