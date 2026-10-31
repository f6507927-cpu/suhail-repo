import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accountCopyDictionary, reviewText } from "./types";
import { approvedArabicCopy } from "@/i18n/approved-arabic";

describe("account UI copy locale parity", () => {
  it("uses exact approved Arabic and retains review markers for unapproved phrases", () => {
    expect(Object.keys(accountCopyDictionary).length).toBeGreaterThan(0);
    for (const [key, translations] of Object.entries(accountCopyDictionary)) {
      expect(translations.en, `${key} English`).toBe(key);
      expect(translations.ar, `${key} Arabic`).toBe(
        approvedArabicCopy[key] ?? `⟦AR-REVIEW⟧ ${key}`,
      );
    }
  });

  it("preserves English and keeps unknown Arabic copy marked for review", () => {
    expect(reviewText("ar", "Sign in")).toBe("تسجيل الدخول");
    expect(reviewText("en", "Sign in")).toBe("Sign in");
    expect(reviewText("ar", "Unapproved new phrase")).toBe(
      "⟦AR-REVIEW⟧ Unapproved new phrase",
    );
    expect(reviewText("ar", 'Type "DELETE" to confirm')).toBe(
      'اكتب "\u2066DELETE\u2069" للتأكيد',
    );
    expect(
      reviewText("ar", "That code could not be verified. Try again."),
    ).toBe("تعذّر التحقق من هذا الرمز. حاول مجددًا.");
  });

  it("routes every literal reviewText phrase through the paired dictionary", () => {
    const directory = join(process.cwd(), "src/components/accounts");
    const missing: string[] = [];
    for (const file of readdirSync(directory).filter((entry) =>
      entry.endsWith(".tsx"),
    )) {
      const source = readFileSync(join(directory, file), "utf8");
      const literalCalls = source.matchAll(
        /reviewText\(locale,\s*(?:"([^"]+)"|'([^']+)')/g,
      );
      for (const match of literalCalls) {
        const phrase = match[1] ?? match[2];
        if (!accountCopyDictionary[phrase]) missing.push(`${file}: ${phrase}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
