import { expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../src/db/public", () => ({ dbPublic: { execute } }));
import { GET } from "../src/app/api/stock-research/[slug]/route";
import { PUBLIC_RESEARCH_COPY_APPROVED } from "../src/lib/research/publication-policy";

it("keeps the stock research endpoint empty and uncached before publication copy approval", async () => {
  expect(PUBLIC_RESEARCH_COPY_APPROVED).toBe(false);
  const response = await GET(new Request("http://fixture.invalid/api/stock-research/fixture"), { params: Promise.resolve({ slug: "fixture" }) });
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(await response.text()).toBe("");
  expect(execute).not.toHaveBeenCalled();
});
