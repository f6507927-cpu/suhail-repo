import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SecuritiesPage from "../src/app/[locale]/(private)/admin/(protected)/securities/page";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), counts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/auth/guards", () => ({ requireRole: mocks.guard }));
vi.mock("../src/lib/financial/unmet-search", () => ({ getUnmetSearches: mocks.counts }));
vi.mock("../src/lib/financial/data", () => ({ getFinancialAdminData: async () => ({ securities: [] }) }));
vi.mock("../src/screening/data", () => ({ getScreeningAdminData: async () => ({}) }));
vi.mock("../src/components/financial/FinancialAdmin", () => ({ FinancialAdmin: () => <div>Securities editor</div> }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
describe("aggregate panel is never loaded or serialized for editors", () => {
  it("preserves editor access without the count loader or panel data", async () => {
    mocks.guard.mockResolvedValueOnce({ user: { role: "editor" } });
    mocks.counts.mockClear();
    const page = await SecuritiesPage({ params: Promise.resolve({ locale: "en" }) });
    const html = renderToStaticMarkup(page);
    expect(mocks.guard).toHaveBeenLastCalledWith(["admin", "editor"]);
    expect(mocks.counts).not.toHaveBeenCalled();
    expect(html).toContain("Securities editor");
    expect(html).not.toContain("Unmet searches");
  });
  it("loads the independently guarded count loader only for admins", async () => {
    mocks.guard.mockResolvedValueOnce({ user: { role: "admin" } });
    mocks.counts.mockResolvedValueOnce([{ query: "private-unmet", count: 17 }]);
    const page = await SecuritiesPage({ params: Promise.resolve({ locale: "en" }) });
    const html = renderToStaticMarkup(page);
    expect(mocks.counts).toHaveBeenCalledTimes(1);
    expect(html).toContain("private-unmet");
    expect(html).toContain("Unmet searches");
  });
});
