import { describe, expect, test } from "bun:test";

import { formatPersianNumber } from "@/lib/persian-number";

describe("formatPersianNumber", () => {
  test("translates every digit", () => {
    expect(formatPersianNumber(1234567890)).toBe("۱٬۲۳۴٬۵۶۷٬۸۹۰");
  });

  test("keeps a zero as a persian zero", () => {
    expect(formatPersianNumber(0)).toBe("۰");
  });

  test("leaves a negative sign alone", () => {
    expect(formatPersianNumber(-12)).toBe("-۱۲");
  });

  test("groups thousands with the persian separator", () => {
    expect(formatPersianNumber(1000)).toBe("۱٬۰۰۰");
    expect(formatPersianNumber(999)).toBe("۹۹۹");
    expect(formatPersianNumber(1000000)).toBe("۱٬۰۰۰٬۰۰۰");
  });
});
