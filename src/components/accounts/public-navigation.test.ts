import { describe, expect, it } from "vitest";
import { mfaPublicHomeHref } from "./MfaScreens";

describe("public account exits", () => {
  it("always directs MFA exits to the localized public home", () => {
    expect(mfaPublicHomeHref("ar")).toBe("/");
    expect(mfaPublicHomeHref("en")).toBe("/en");
  });
});
