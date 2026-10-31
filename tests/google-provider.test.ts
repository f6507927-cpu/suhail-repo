import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requireGoogleProvider } from "../src/lib/auth/server";
const fetchSettings = vi.fn();
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://auth.fixture.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","public-fixture-key");
  vi.stubGlobal("fetch", fetchSettings);
  fetchSettings.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("reads only public provider settings with a bounded uncached request", async () => {
  fetchSettings.mockResolvedValue(Response.json({external:{google:true}}));
  await expect(requireGoogleProvider()).resolves.toBeUndefined();
  expect(fetchSettings).toHaveBeenCalledWith("https://auth.fixture.test/auth/v1/settings", expect.objectContaining({
    headers:{apikey:"public-fixture-key"},cache:"no-store",redirect:"error",signal:expect.any(AbortSignal),
  }));
});
it.each([{external:{google:false}}, {external:{}}, {}])("rejects disabled/missing Google settings %j", async settings => {
  fetchSettings.mockResolvedValue(Response.json(settings));
  await expect(requireGoogleProvider()).rejects.toMatchObject({status:502,code:"provider_unavailable"});
});
it("rejects provider HTTP and transport failures", async () => {
  fetchSettings.mockResolvedValue(new Response(null,{status:503}));
  await expect(requireGoogleProvider()).rejects.toThrow();
  fetchSettings.mockRejectedValue(new Error("timeout"));
  await expect(requireGoogleProvider()).rejects.toThrow();
});
