import { describe, expect, test } from "bun:test";

import { formatPersianNumber } from "@/lib/persian-number";

describe("formatPersianNumber", () => {
  test("translates every digit", () => {
    expect(formatPersianNumber(1234567890)).toBe("۱۲۳۴۵۶۷۸۹۰");
  });

  test("keeps a zero as a persian zero", () => {
    expect(formatPersianNumber(0)).toBe("۰");
  });

  test("leaves a negative sign alone", () => {
    expect(formatPersianNumber(-12)).toBe("-۱۲");
  });
});
