import { afterEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { publicPortraitUrl } from "../src/lib/public-media";
import { publicCsp,secureResponse } from "../src/security/headers";
import { privateCsp } from "../src/lib/auth/csp";
afterEach(()=>vi.unstubAllEnvs());
describe("public portrait object URLs",()=>{
  it("retains the configured media origin through the public response wrapper",()=>{
    vi.stubEnv("PUBLIC_MEDIA_BASE_URL","https://media.fixture.invalid/assets/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://auth.fixture.test");
    expect(secureResponse(new Response(),true).headers.get("Content-Security-Policy")).toContain("https://media.fixture.invalid");
    const privatePolicy=privateCsp("fixture","https://auth.fixture.test",false);
    expect(secureResponse(new Response(null,{headers:{"Content-Security-Policy":privatePolicy}}),true).headers.get("Content-Security-Policy")).toBe(privatePolicy);
  });
  it("allows only the configured media origin on public pages, not private pages",()=>{
    expect(publicCsp(undefined,false,"https://media.fixture.invalid/assets/")).toContain("img-src 'self' data: https://media.fixture.invalid");
    expect(privateCsp("fixture",undefined,false)).toContain("img-src 'self' data:;");
    expect(publicCsp(undefined,false)).toContain("img-src 'self' data:;");
    expect(()=>publicCsp(undefined,false,"https://user:pass@media.fixture.invalid/")).toThrow("Public media requires");
  });
  it("needs no storage configuration if there is no portrait",()=>expect(publicPortraitUrl(null)).toBeNull());
  it("encodes object paths beneath the configured public base, never the S3 API",()=>{
    vi.stubEnv("PUBLIC_MEDIA_BASE_URL","https://media.example.invalid/public/");
    expect(publicPortraitUrl("analysts/a b.jpg")).toBe("https://media.example.invalid/public/analysts/a%20b.jpg");
  });
  it.each(["../escape.jpg","/escape.jpg","a\\b.jpg","a//b.jpg"])("rejects invalid key %s",key=>{
    expect(()=>publicPortraitUrl(key)).toThrow("Invalid public portrait");
  });
  it("fails explicitly for missing configuration when a real portrait is present",()=>{
    vi.stubEnv("PUBLIC_MEDIA_BASE_URL","");
    expect(()=>publicPortraitUrl("analysts/person.jpg")).toThrow("Public media environment validation");
  });
});
