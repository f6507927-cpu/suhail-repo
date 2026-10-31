import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/font/google", () => ({
  IBM_Plex_Sans_Arabic: () => ({ variable: "arabic" }),
  IBM_Plex_Sans: () => ({ variable: "latin" }),
  IBM_Plex_Mono: () => ({ variable: "numbers" }),
}));
vi.mock("../src/lib/auth/guards", () => ({ requireUser: mocks.requireUser }));
vi.mock("next-intl/server", () => ({getTranslations: async () => (key: string) => key}));
vi.mock("../src/components/foundation/SiteHeader", () => ({
  SiteHeader: ({ accountControl }: {accountControl: React.ReactNode}) => <header>{accountControl}</header>,
}));
import { PrivateSiteHeader } from "../src/components/accounts/PrivateSiteHeader";
import { AuthError } from "../src/lib/auth/errors";
import { safeNext } from "../src/lib/auth/paths";
import { RecoveryDocument } from "../src/components/foundation/RecoveryDocument";

beforeEach(() => vi.clearAllMocks());
describe("Private header optional identity without redirects", () => {
  it.each(["sign_in_required","recovery_required"])("renders anonymous %s", async code => {
    mocks.requireUser.mockRejectedValue(new AuthError(401,code));
    expect(renderToStaticMarkup(await PrivateSiteHeader({locale:"en"}))).toContain('href="/en/auth/sign-in"');
    expect(mocks.requireUser).toHaveBeenCalledWith({consent:false});
  });
  it.each(["user","editor","admin"])("renders %s before consent/MFA checks", async role => {
    mocks.requireUser.mockResolvedValue({ user:{full_name:"Synthetic Identity",role} });
    const html = renderToStaticMarkup(await PrivateSiteHeader({locale:"ar"}));
    expect(html).toContain("Synthetic Identity");
    expect(html).toContain('href="/account"');
    expect(html).toContain('action="/auth/sign-out"');
    expect(html.includes('href="/admin"')).toBe(role!=="user");
  });
  it("does not disguise unexpected errors as signed-out identity", async () => {
    const error = new Error("Synthetic provider failure");
    mocks.requireUser.mockRejectedValue(error);
    await expect(PrivateSiteHeader({locale:"ar"})).rejects.toBe(error);
  });
});

describe("Standalone navigation recovery", () => {
  it("continues validating verification destinations without rendering a Back link", () => {
    for (const next of [undefined,"https://evil.invalid","//evil.invalid","/en/auth/sign-in","/admin/mfa/verify","/%2fevil.invalid","/a\\b"]) {
      expect(safeNext(next)).toBeNull();
    }
    expect(safeNext("/en/admin?version=valid")).toBe("/en/admin?version=valid");
  });
  it("root failures have both home links without intl providers or request reads", () => {
    const html = renderToStaticMarkup(<RecoveryDocument kind="error"/>);
    expect(html).toContain("<html");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/en"');
  });
});
