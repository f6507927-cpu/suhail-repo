import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SearchResults.tsx", import.meta.url), "utf8");

describe("search result alignment", () => {
  it("uses shared grid tracks and a neutral unscreened badge", () => {
    expect(source).toContain("sm:grid-cols-[minmax(0,1fr)_6rem_7rem_14rem]");
    expect(source).toContain("border-border bg-secondary");
    expect(source).toContain("role=\"status\"");
    expect(source).not.toContain('<StatusBadge status="insufficient_data"');
  });
});
