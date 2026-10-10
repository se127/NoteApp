import { describe, expect, test } from "bun:test";

import {
  formatAbsoluteTime,
  formatRelativeTime,
  hasBeenEdited,
} from "@/lib/relative-time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const HALF_MINUTE = 30 * SECOND;

function sqliteUtcAgo(elapsed: number): string {
  return new Date(Date.now() - elapsed)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

function sqliteUtcFromNow(offset: number): string {
  return new Date(Date.now() + offset)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

describe("formatRelativeTime", () => {
  test("counts the seconds", () => {
    expect(formatRelativeTime(sqliteUtcAgo(15 * SECOND))).toBe(
      "۱۵ ثانیه ی پیش",
    );
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
    expect(formatRelativeTime(sqliteUtcAgo(HOUR))).toBe("۱ ساعت پیش");
  });

  test("counts the hours", () => {
    expect(formatRelativeTime(sqliteUtcAgo(5 * HOUR))).toBe("۵ ساعت پیش");
  });

  test("counts the days", () => {
    expect(formatRelativeTime(sqliteUtcAgo(6 * DAY))).toBe("۶ روز پیش");
  });

  test("counts the months once a month has passed", () => {
    expect(formatRelativeTime(sqliteUtcAgo(70 * DAY))).toBe("۲ ماه پیش");
  });

  test("counts the years once a year has passed", () => {
    expect(formatRelativeTime(sqliteUtcAgo(400 * DAY))).toBe("۱ سال پیش");
  });

  test("calls a note made a moment ago just now instead of zero seconds", () => {
    expect(formatRelativeTime(sqliteUtcAgo(0))).toBe("همین الان");
    expect(formatRelativeTime(sqliteUtcAgo(9 * SECOND))).toBe("همین الان");
  });

  test("starts counting seconds once a moment has passed", () => {
    expect(formatRelativeTime(sqliteUtcAgo(11 * SECOND))).toBe(
      "۱۱ ثانیه ی پیش",
    );
  });

  test("keeps the last day a day rather than rounding up to a month", () => {
    expect(formatRelativeTime(sqliteUtcAgo(29 * DAY))).toBe("۲۹ روز پیش");
  });

  test("starts a month on the same clock as the days", () => {
    expect(formatRelativeTime(sqliteUtcAgo(31 * DAY))).toBe("۱ ماه پیش");
    expect(formatRelativeTime(sqliteUtcAgo(59 * DAY))).toBe("۱ ماه پیش");
    expect(formatRelativeTime(sqliteUtcAgo(61 * DAY))).toBe("۲ ماه پیش");
  });

  test.each([
    [30, "۱ ماه پیش"],
    [31, "۱ ماه پیش"],
    [59, "۱ ماه پیش"],
    [60, "۲ ماه پیش"],
    [89, "۲ ماه پیش"],
    [90, "۳ ماه پیش"],
    [359, "۱۱ ماه پیش"],
    [360, "۱ سال پیش"],
    [400, "۱ سال پیش"],
  ])(
    "reads %i days ago as %p from the elapsed clock alone",
    (days, expected) => {
      expect(formatRelativeTime(sqliteUtcAgo((days as number) * DAY))).toBe(
        expected,
      );
    },
  );

  test("keeps the ezafe off a future time because در governs directly", () => {
    expect(formatRelativeTime(sqliteUtcFromNow(7 * MINUTE + HALF_MINUTE))).toBe(
      "در ۷ دقیقه",
    );
    expect(formatRelativeTime(sqliteUtcFromNow(5 * HOUR + HALF_MINUTE))).toBe(
      "در ۵ ساعت",
    );
    expect(formatRelativeTime(sqliteUtcFromNow(5 * SECOND))).not.toContain(
      " ی",
    );
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

describe("hasBeenEdited", () => {
  test("reports an edit once the two timestamps differ", () => {
    expect(hasBeenEdited("2026-01-01 10:00:00", "2026-01-02 11:30:00")).toBe(
      true,
    );
  });

  test("reports no edit when both timestamps match", () => {
    expect(hasBeenEdited("2026-01-01 10:00:00", "2026-01-01 10:00:00")).toBe(
      false,
    );
  });

  test("treats the same instant written two ways as one instant", () => {
    expect(hasBeenEdited("2026-01-01 10:00:00", "2026-01-01T10:00:00Z")).toBe(
      false,
    );
  });

  test("reports no edit when both timestamps are missing", () => {
    expect(hasBeenEdited("", "")).toBe(false);
  });

  test("reports no edit when the stored timestamps are unreadable", () => {
    expect(hasBeenEdited("not a date", "not a date")).toBe(false);
  });

  test("reports an edit when only one timestamp is missing", () => {
    expect(hasBeenEdited("2026-01-01 10:00:00", "")).toBe(false);
    expect(hasBeenEdited("", "2026-01-01 10:00:00")).toBe(true);
  });
});

describe("formatAbsoluteTime", () => {
  test("falls back to a dash for a missing timestamp", () => {
    expect(formatAbsoluteTime("")).toBe("—");
  });
});
