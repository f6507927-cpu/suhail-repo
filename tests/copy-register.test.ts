import { describe, it, expect } from "vitest";
import { checkRegister, HARD_BAN_PATTERNS, WARNING_PATTERNS } from "../src/lib/copy-register";
import en from "../src/i18n/messages/en.json";
import ar from "../src/i18n/messages/ar.json";

describe("D-120 copy register", () => {
  for (const locale of ["ar", "en"] as const) {
    for (const pattern of HARD_BAN_PATTERNS) {
      const term = pattern.replace("[- ]", "-").replace("['’]", "'");
      it(`${locale} rejects ${term}`, () => {
        expect(checkRegister(`Text ${term.toUpperCase()} text`, locale).ok).toBe(false);
      });
    }
    for (const term of ["star", "stars", "navigation", "journey", "journeys", "horizon", "horizons"]) {
      it(`${locale} warns for ${term}`, () => {
        const result = checkRegister(term, locale);
        expect(result.ok).toBe(true);
        expect(result.warnings).toContain(term);
      });
    }
    it(`${locale} permits only exact mandatory disclaimers`, () => {
      for (const dictionary of [ar, en]) {
        expect(checkRegister(`${dictionary.disclaimer.short} ${dictionary.disclaimer.full}`, locale).ok).toBe(true);
      }
      expect(checkRegister(`${en.disclaimer.full} You should buy.`, locale).ok).toBe(false);
      expect(checkRegister(en.disclaimer.full.replace("This application", "The application"), locale).ok).toBe(false);
      expect(checkRegister("This is not a recommendation.", locale).ok).toBe(false);
    });
  }
  it("uses boundaries and does not invent Arabic bans", () => {
    expect(checkRegister("seller buyingpower fictional research", "en").ok).toBe(true);
    expect(checkRegister("أبحاث وبيانات", "ar").ok).toBe(true);
    expect(WARNING_PATTERNS).toHaveLength(4);
  });
});
