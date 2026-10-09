import { describe, expect, test } from "bun:test";

import { formatAbsoluteTime, formatRelativeTime } from "@/lib/relative-time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function sqliteUtcAgo(elapsed: number): string {
  return new Date(Date.now() - elapsed)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

describe("formatRelativeTime", () => {
  test("counts the seconds", () => {
    expect(formatRelativeTime(sqliteUtcAgo(5 * SECOND))).toBe("۵ ثانیه ی پیش");
  });

  test("keeps counting seconds right up to a minute", () => {
    expect(formatRelativeTime(sqliteUtcAgo(59 * SECOND))).toBe(
      "۵۹ ثانیه ی پیش",
    );
  });

  test("prints a number instead of a word for a single minute", () => {
    expect(formatRelativeTime(sqliteUtcAgo(MINUTE))).toBe("۱ دقیقه ی پیش");
  });

  test("counts the minutes", () => {
    expect(formatRelativeTime(sqliteUtcAgo(7 * MINUTE))).toBe("۷ دقیقه ی پیش");
  });

  test("prints a number instead of a word for a single hour", () => {
    expect(formatRelativeTime(sqliteUtcAgo(HOUR))).toBe("۱ ساعت ی پیش");
  });

  test("counts the hours", () => {
    expect(formatRelativeTime(sqliteUtcAgo(5 * HOUR))).toBe("۵ ساعت ی پیش");
  });

  test("counts the days", () => {
    expect(formatRelativeTime(sqliteUtcAgo(6 * DAY))).toBe("۶ روز ی پیش");
  });

  test("counts the months once a month has passed", () => {
    expect(formatRelativeTime(sqliteUtcAgo(70 * DAY))).toBe("۲ ماه ی پیش");
  });

  test("counts the years once a year has passed", () => {
    expect(formatRelativeTime(sqliteUtcAgo(400 * DAY))).toBe("۱ سال ی پیش");
  });

  test("says nothing is older than a moment for a note made now", () => {
    expect(formatRelativeTime(sqliteUtcAgo(0))).toBe("۰ ثانیه ی پیش");
  });

  test("falls back to a dash for a missing timestamp", () => {
    expect(formatRelativeTime("")).toBe("—");
  });

  test("falls back to a dash for an unreadable timestamp", () => {
    expect(formatRelativeTime("not a date")).toBe("—");
  });

  test("reads the stored timestamp as utc rather than local time", () => {
    expect(formatAbsoluteTime("2026-01-01 10:30:00")).toBe(
      formatAbsoluteTime("2026-01-01T10:30:00Z"),
    );
  });
});

describe("formatAbsoluteTime", () => {
  test("falls back to a dash for a missing timestamp", () => {
    expect(formatAbsoluteTime("")).toBe("—");
  });
});
