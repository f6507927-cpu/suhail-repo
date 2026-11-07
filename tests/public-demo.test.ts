import { describe, expect, it } from "vitest";
import { publicDemoContentVisible } from "../src/lib/public-demo";

const fixture = { PUBLIC_DEMO_FIXTURES: "1", SITE_MODE: "preview", SITE_URL: "http://127.0.0.1:3500" };

describe("public demo visibility", () => {
  it("hides demo content on every deployment without an explicit fixture opt-in", () => {
    expect(publicDemoContentVisible({})).toBe(false);
    expect(publicDemoContentVisible({ SITE_MODE: "preview", SITE_URL: "https://suhail.example.com" })).toBe(false);
    expect(publicDemoContentVisible({ SITE_MODE: "live", SITE_URL: "https://suhail.example.com" })).toBe(false);
    expect(publicDemoContentVisible({ ...fixture, PUBLIC_DEMO_FIXTURES: "true" })).toBe(false);
  });
  it("never honours the opt-in in live mode", () => {
    expect(publicDemoContentVisible({ ...fixture, SITE_MODE: "live" })).toBe(false);
  });
  it("honours the opt-in only on loopback or reserved fixture hosts", () => {
    for (const url of ["http://127.0.0.1:3500", "http://localhost:3000", "http://[::1]:3000",
      "https://security.fixture.test", "https://fixture.invalid", "http://app.localhost"])
      expect(publicDemoContentVisible({ ...fixture, SITE_URL: url })).toBe(true);
    for (const url of ["https://suhail.replit.app", "https://fixture.test.example.com", "not a url", undefined])
      expect(publicDemoContentVisible({ ...fixture, SITE_URL: url })).toBe(false);
  });
  it("defaults to the process environment", () => {
    expect(typeof publicDemoContentVisible()).toBe("boolean");
  });
});
