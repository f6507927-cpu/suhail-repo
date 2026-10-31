import { describe, expect, it } from "vitest";
import { getAppVersion } from "./version";

describe("getAppVersion", () => {
  it("returns the package version when no git SHA is available", () => {
    expect(getAppVersion("0.1.0", undefined)).toBe("0.1.0");
  });

  it("adds a short git SHA when one is available", () => {
    expect(getAppVersion("0.1.0", "1234567890abcdef")).toBe("0.1.0+1234567");
  });
});
