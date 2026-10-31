import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { securitySlug } from "../src/lib/financial/service";
describe("security slugs", () => {
  it.each([["NASDAQ", "AAPL", "nasdaq-aapl"], ["NYSE", "BRK.B", "nyse-brk-b"],
    ["NYSE", "BRK--B", "nyse-brk-b"], ["NYSE", "TEST / B", "nyse-test-b"]])("%s %s", (exchange, ticker, slug) => {
    expect(securitySlug(exchange, ticker)).toBe(slug);
  });
});
