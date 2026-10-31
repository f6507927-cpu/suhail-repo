import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { formatCalendarDate, formatDate, formatTimestamp, DISPLAY_TIME_ZONE } from "../src/lib/format";

describe("D-121 date display policy", () => {
  it.each(["UTC", "America/Los_Angeles", "Pacific/Kiritimati"])("ignores host zone %s", (zone) => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      for (const locale of ["ar", "en"] as const) {
        expect(formatTimestamp("2026-10-11T22:30:00Z", locale, { dateStyle: "medium" }))
          .toBe(formatCalendarDate("2026-10-12", locale, { dateStyle: "medium" }));
        expect(formatDate("2026-10-11", locale, { dateStyle: "medium", timeZone: "Pacific/Honolulu" }))
          .toBe(formatCalendarDate("2026-10-11", locale, { dateStyle: "medium" }));
        expect(formatDate("2026-10-11", locale)).not.toMatch(/[٠-٩]/);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
  it("honors explicit market timestamp zones and style options", () => {
    expect(DISPLAY_TIME_ZONE).toBe("Asia/Riyadh");
    expect(formatTimestamp("2026-10-11T22:30:00Z", "en", { dateStyle: "medium", timeStyle: "short" }))
      .toBe("Oct 12, 2026, 1:30 AM");
    expect(formatTimestamp("2026-10-11T22:30:00Z", "en", { dateStyle: "medium", timeZone: "America/New_York" }))
      .toBe("Oct 11, 2026");
    expect(formatTimestamp("2026-10-11T22:30:00Z", "en", { dateStyle: "medium", timeZone: undefined }))
      .toBe("Oct 12, 2026");
    expect(formatTimestamp("2026-10-11T22:30:00Z", "en", { hour: "numeric", minute: "2-digit" }))
      .toContain("1:30");
  });
  it("keeps missing values explicit and rejects malformed calendar dates", () => {
    expect(formatTimestamp(null, "ar")).toBe("—");
    expect(formatDate(undefined, "en")).toBe("—");
    expect(formatCalendarDate(null, "en")).toBe("—");
    expect(() => formatCalendarDate("2026-02-30", "en")).toThrow(RangeError);
    expect(() => formatCalendarDate("2026-10-11T00:00Z", "en")).toThrow(RangeError);
  });
});

describe("formatting architecture lint is part of normal pnpm lint", () => {
  const eslint = new ESLint();
  it.each([
    "new Intl.DateTimeFormat('en')",
    "Intl['DateTimeFormat']('en')",
    "new Intl[`DateTimeFormat`]('en')",
    "new Intl['Date' + 'TimeFormat']('en')",
    "date.toLocaleDateString()",
    "date?.['toLocaleDateString']?.()",
    "date[`toLocaleString`]()",
    "number.toLocaleString()",
    "date['toLocale' + 'String']()",
    "date.toLocaleTimeString()",
  ])("rejects %s", async (source) => {
    const [result] = await eslint.lintText(source, { filePath: "src/format-guard-sample.ts" });
    expect(result.messages.some((message) => message.ruleId === "formatting/shared")).toBe(true);
  });
  it("allows the shared module and calls through it", async () => {
    const [shared] = await eslint.lintText("new Intl.DateTimeFormat('en')", { filePath: "src/lib/format.ts" });
    const [caller] = await eslint.lintText("formatTimestamp(value, 'ar')", { filePath: "src/format-guard-sample.ts" });
    expect([...shared.messages, ...caller.messages].filter((message) => message.ruleId === "formatting/shared")).toEqual([]);
  });
});
