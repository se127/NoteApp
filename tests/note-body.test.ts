import { describe, expect, test } from "bun:test";

import { bodyToHtml } from "@/lib/note-body";

const STORED_CODE_BLOCK =
  '<pre dir="ltr"><code class="language-html">&lt;p&gt;hi&lt;/p&gt;</code></pre>';

describe("bodyToHtml", () => {
  test("returns an empty string for an empty body", () => {
    expect(bodyToHtml("")).toBe("");
    expect(bodyToHtml("   \n  ")).toBe("");
  });

  test("wraps a single line in a paragraph", () => {
    expect(bodyToHtml("متن")).toBe("<p>متن</p>");
  });

  test("splits plain text newlines into paragraphs", () => {
    expect(bodyToHtml("خط اول\nخط دوم")).toBe("<p>خط اول</p><p>خط دوم</p>");
  });

  test("escapes markup in plain text so it stays text", () => {
    expect(bodyToHtml("a < b & c > d")).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  test("leaves text that merely looks like a tag as text", () => {
    expect(bodyToHtml("use <b> for bold")).toBe(
      "<p>use &lt;b&gt; for bold</p>",
    );
  });

  test("passes stored html through untouched", () => {
    expect(bodyToHtml("<p>قالب‌دار</p>")).toBe("<p>قالب‌دار</p>");
    expect(bodyToHtml("<p><strong>پررنگ</strong></p>")).toBe(
      "<p><strong>پررنگ</strong></p>",
    );
  });

  test("passes stored html with several paragraphs through untouched", () => {
    expect(bodyToHtml("<p>اول</p><p>دوم</p>")).toBe("<p>اول</p><p>دوم</p>");
  });

  test("passes stored heading html through untouched", () => {
    expect(bodyToHtml("<h2>عنوان</h2>")).toBe("<h2>عنوان</h2>");
    expect(bodyToHtml("<h3>زیرعنوان</h3><p>متن</p>")).toBe(
      "<h3>زیرعنوان</h3><p>متن</p>",
    );
  });

  test("passes stored code block html through untouched", () => {
    expect(bodyToHtml(STORED_CODE_BLOCK)).toBe(STORED_CODE_BLOCK);
    expect(bodyToHtml(`<p>متن</p>${STORED_CODE_BLOCK}`)).toBe(
      `<p>متن</p>${STORED_CODE_BLOCK}`,
    );
  });

  test("leaves a plain line that looks like a heading as text", () => {
    expect(bodyToHtml("<h2 something")).toBe("<p>&lt;h2 something</p>");
  });

  test("keeps a blank line inside plain text as an empty paragraph", () => {
    expect(bodyToHtml("اول\n\nدوم")).toBe("<p>اول</p><p><br></p><p>دوم</p>");
  });
});
