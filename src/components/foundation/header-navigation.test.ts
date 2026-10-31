import { describe, expect, it } from "vitest";
import { shouldShowHeaderSearch } from "./header-search";

describe("shared header search placement", () => {
  it("hides the redundant search on either localized home and search route", () => {
    expect(shouldShowHeaderSearch("/")).toBe(false);
    expect(shouldShowHeaderSearch("/en")).toBe(false);
    expect(shouldShowHeaderSearch("/search")).toBe(false);
    expect(shouldShowHeaderSearch("/en/search")).toBe(false);
  });

  it("keeps compact search on other routes", () => {
    expect(shouldShowHeaderSearch("/methodology")).toBe(true);
    expect(shouldShowHeaderSearch("/en/methodology")).toBe(true);
  });
});
