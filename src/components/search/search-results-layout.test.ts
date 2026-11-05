import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SearchResults.tsx", import.meta.url), "utf8");

describe("search result alignment", () => {
  it("uses whole-row targets and a plain unscreened label without column tracks", () => {
    expect(source).toContain("group flex min-h-14 w-full");
    expect(source).not.toContain("grid-cols");
    expect(source).toContain('className="text-sm text-muted-foreground" role="status"');
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("hover:bg-");
    expect(source).toContain("role=\"status\"");
    expect(source).not.toContain('<StatusBadge status="insufficient_data"');
  });
});
