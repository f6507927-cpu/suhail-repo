import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AuthError } from "../src/lib/auth/errors";
const fixture=vi.hoisted(()=>({guard:vi.fn(),factors:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("next-intl/server",()=>({getTranslations:async()=>(key:string)=>key}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
vi.mock("@/lib/auth/guards",()=>({requireMfaUser:fixture.guard}));
vi.mock("@/components/accounts",()=>({MfaClientPanel:({mode,next,locale}:{mode:string;next:string;locale:string})=>createElement("div",{"data-mode":mode,"data-next":next,"data-locale":locale})}));
import MfaEnrollPage from "../src/app/[locale]/(private)/admin/mfa/enroll/page";
beforeEach(()=>{
  fixture.guard.mockReset().mockResolvedValue({auth:{auth:{mfa:{listFactors:fixture.factors}}}});
  fixture.factors.mockReset();
});
const props=(locale="en",next?:string)=>({params:Promise.resolve({locale}),searchParams:Promise.resolve({next})});
it.each(["en","ar"])("existing verified TOTP on %s enrollment routes to verification",async locale=>{
  fixture.factors.mockResolvedValue({data:{totp:[{status:"verified"}]},error:null});
  const prefix=locale==="en"?"/en":"";
  await expect(MfaEnrollPage(props(locale,`${prefix}/admin/settings`))).rejects.toThrow(`REDIRECT:${prefix}/admin/mfa/verify?next=${encodeURIComponent(`${prefix}/admin/settings`)}`);
});
it.each(["https://evil.test","//evil.test","/en/admin/mfa/enroll"])("unsafe next %s cannot introduce an enrollment loop or external redirect",async next=>{
  fixture.factors.mockResolvedValue({data:{totp:[{status:"verified"}]},error:null});
  await expect(MfaEnrollPage(props("en",next))).rejects.toThrow("REDIRECT:/en/admin/mfa/verify?next=%2Fen%2Fadmin");
});
it("without a verified factor the enrollment panel remains available",async()=>{
  fixture.factors.mockResolvedValue({data:{totp:[{status:"unverified"}]},error:null});
  const html=renderToStaticMarkup(await MfaEnrollPage(props("ar")));
  expect(html).toContain('data-mode="enroll"');
  expect(html).toContain('data-next="/admin"');
});
it("ordinary users are refused before listing factors",async()=>{
  fixture.guard.mockRejectedValue(new AuthError(403,"role_required"));
  await expect(MfaEnrollPage(props())).rejects.toThrow(AuthError);
  expect(fixture.factors).not.toHaveBeenCalled();
});
it("factor lookup failure cannot silently permit enrollment",async()=>{
  fixture.factors.mockResolvedValue({data:null,error:new Error("unavailable")});
  await expect(MfaEnrollPage(props())).rejects.toThrow(AuthError);
});
