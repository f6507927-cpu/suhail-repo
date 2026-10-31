import { describe, expect, it } from "vitest";
import { requirePublicProduction, requireVisibilityChange } from "../src/lib/methodology/gates";

describe("Methodology publication gates", () => {
  it("refuses production for private versions", () => {
    expect(() => requirePublicProduction(false)).toThrow("Publish the version before enabling production");
    expect(() => requirePublicProduction(true)).not.toThrow();
  });
  it("refuses unpublishing a production-enabled version", () => {
    expect(() => requireVisibilityChange(true, false, false)).toThrow("production-enabled version cannot be unpublished");
  });
  it("refuses unpublishing the editorial default independently of production", () => {
    expect(() => requireVisibilityChange(false, false, true)).toThrow("select another default first");
  });
  it("allows publication and unrelated non-production unpublishing", () => {
    expect(() => requireVisibilityChange(true, true, true)).not.toThrow();
    expect(() => requireVisibilityChange(false, false, false)).not.toThrow();
  });
});
