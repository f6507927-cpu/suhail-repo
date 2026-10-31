import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { searchPublicStocks } from "../src/db/search-public";
import { normalizeSearch } from "../src/lib/search-normalization";
import { getUnmetSearches } from "../src/lib/financial/unmet-search";
import { UnmetSearchPanel } from "../src/components/financial/UnmetSearchPanel";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/auth/guards", () => ({ requireRole: mocks.guard }));
vi.mock("../src/db/app", () => ({ dbApp: { execute: mocks.execute } }));
beforeEach(() => { vi.clearAllMocks(); });
describe("unmet query privacy and failure isolation", () => {
  it("only a successful valid miss attempts recording; failed recording preserves the empty state", async () => {
    const execute = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("record unavailable"));
    await expect(searchPublicStocks("Uncovered", { execute } as never)).resolves.toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(new PgDialect().sqlToQuery(execute.mock.calls[1][0]).sql).toContain("record_unmet_search");
    for (const value of ["", [], "x".repeat(41)]) {
      const db = { execute: vi.fn() };
      expect(await searchPublicStocks(value, db as never)).toEqual([]);
      expect(db.execute).not.toHaveBeenCalled();
    }
    const matched = vi.fn().mockResolvedValue([{ ticker: "ABC" }]);
    await searchPublicStocks("ABC", { execute: matched } as never);
    expect(matched).toHaveBeenCalledTimes(1);
    const failed = vi.fn().mockRejectedValue(new Error("search failure"));
    await expect(searchPublicStocks("ABC", { execute: failed } as never)).rejects.toThrow("search failure");
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it("separately guards the aggregate loader before data access and uses deterministic ranking", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("editor or AAL1 denied"));
    await expect(getUnmetSearches()).rejects.toThrow("denied");
    expect(mocks.guard).toHaveBeenCalledWith(["admin"]);
    expect(mocks.execute).not.toHaveBeenCalled();
    mocks.guard.mockResolvedValueOnce({ user: { role: "admin" }, currentLevel: "aal2" });
    mocks.execute.mockResolvedValueOnce([{ query: "abc", count: 2 }]);
    expect(await getUnmetSearches()).toEqual([{ query: "abc", count: 2 }]);
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
    expect(query.sql).toContain('order by sum(count) desc, normalized_query collate "C" asc');
    expect(query.sql).toContain("limit 20");
  });
  it("has consistent case/Arabic normalization and a marked review panel with isolated counts", () => {
    expect(normalizeSearch(" أإآةىـ مُدرَسة ")).toBe("اااهي مدرسه");
    expect(normalizeSearch(" AAPL ")).toBe("aapl");
    const html = renderToStaticMarkup(<UnmetSearchPanel locale="ar" rows={[{ query: "apple", count: 123 }]} />);
    expect(html).toContain("⟦AR-REVIEW⟧");
    expect(html).toContain("font-mono tabular-nums");
    expect(html).toContain('dir="ltr"');
  });
});
