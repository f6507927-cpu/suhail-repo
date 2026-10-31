import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({
  revalidate:vi.fn(), role:vi.fn(), mutate:vi.fn(), screen:vi.fn(), verify:vi.fn(),
  universe:vi.fn(), ingest:vi.fn(), settings:vi.fn(), lookup:vi.fn(), financial:vi.fn(),
}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("../src/lib/auth/guards",()=>({requireRole:mocks.role}));
vi.mock("../src/lib/auth/actions",()=>({withAdminAction:mocks.mutate}));
vi.mock("../src/lib/auth/admin-mutations",()=>({mutateSettings:mocks.settings,mutateRole:vi.fn()}));
vi.mock("../src/screening/service",()=>({screenSecurity:mocks.screen}));
vi.mock("../src/screening/verify",()=>({verifyRun:mocks.verify}));
vi.mock("../src/jobs/screen-universe",()=>({screenUniverse:mocks.universe}));
vi.mock("../src/jobs/ingest-sec",()=>({ingestUniverse:mocks.ingest,runIngestBatch:vi.fn()}));
vi.mock("../src/ingest/sec/ingest",()=>({lookupSecurity:mocks.lookup,ingestSecurity:vi.fn(),safeIngestError:()=>"operation_failed"}));
vi.mock("../src/lib/financial/service",()=>({mutateFinancial:mocks.financial,addSecurity:vi.fn(),idSchema:{parse:(v:unknown)=>v}}));
import { runScreenAction, verifyScreenAction, runUniverseAction } from "../src/app/[locale]/(private)/admin/(protected)/screening-actions";
import { financialAction } from "../src/app/[locale]/(private)/admin/(protected)/financial-actions";
import { saveSettings } from "../src/app/[locale]/(private)/admin/(protected)/actions";
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({});
  mocks.mutate.mockImplementation((_role,work)=>work({},{}));
  mocks.screen.mockResolvedValue({unchanged:false,runId:"fixture"});
  mocks.verify.mockResolvedValue({valid:true});
  mocks.lookup.mockResolvedValue({});
});
function publicPaths() {return mocks.revalidate.mock.calls.map(([path])=>path).filter(path=>!path.includes("/admin/"));}
it("invalidates the public stock/search surfaces in both locales only after changed runs", async()=>{
  await runScreenAction({securityId:"fixture",methodologyVersionId:"fixture"});
  expect(publicPaths()).toEqual(["/stock/[slug]","/search","/en/stock/[slug]","/en/search"]);
  mocks.revalidate.mockClear();
  mocks.screen.mockResolvedValue({unchanged:true,runId:"fixture"});
  await runScreenAction({securityId:"fixture",methodologyVersionId:"fixture"});
  await verifyScreenAction("fixture");
  expect(publicPaths()).toEqual([]);
  mocks.screen.mockRejectedValue(new Error("secret"));
  await runScreenAction({securityId:"fixture",methodologyVersionId:"fixture"});
  expect(publicPaths()).toEqual([]);
});
it("keeps lookup and failed financial changes read-only with respect to public caches",async()=>{
  await financialAction({operation:"lookup",data:{ticker:"FAKE"}});
  expect(publicPaths()).toEqual([]);
  mocks.financial.mockResolvedValue("fixture");
  await financialAction({operation:"company",securityId:"fixture"});
  expect(publicPaths()).toContain("/en/stock/[slug]");
  mocks.revalidate.mockClear();
  mocks.financial.mockRejectedValue(new Error("secret"));
  await financialAction({operation:"company",securityId:"fixture"});
  expect(publicPaths()).toEqual([]);
});
it("settings invalidate public methodology and stocks only after transaction succeeds",async()=>{
  mocks.settings.mockResolvedValue(true);
  await saveSettings(null,false);
  expect(publicPaths()).toContain("/en/methodology/[slug]");
  mocks.revalidate.mockClear();
  mocks.settings.mockRejectedValue(new Error("secret"));
  await saveSettings(null,false);
  expect(publicPaths()).toEqual([]);
});
it("bulk read/noop/failed results never invalidate public pages",async()=>{
  mocks.universe.mockResolvedValue({summary:{inserted:0}});
  await runUniverseAction("screen");
  expect(publicPaths()).toEqual([]);
  mocks.universe.mockResolvedValue({summary:{inserted:1}});
  await runUniverseAction("screen");
  expect(publicPaths()).toContain("/en/stock/[slug]");
  mocks.revalidate.mockClear();
  mocks.universe.mockRejectedValue(new Error("secret"));
  await runUniverseAction("screen");
  expect(publicPaths()).toEqual([]);
});
