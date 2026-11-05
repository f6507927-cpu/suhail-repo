import { describe, expect, it, vi } from "vitest";
const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: invalidate }));
import { revalidatePublic } from "../src/security/revalidate-public";
describe("public homepage locale parity", () => {
  it("invalidates both internal locale keys and the external Arabic alias", () => {
    revalidatePublic("settings");
    for (const path of ["/", "/ar", "/en"])
      expect(invalidate).toHaveBeenCalledWith(path, "page");
  });
});
