import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("browser runner isolation", () => {
  it("fails closed for server redirects in the component-only router boundary", async () => {
    const router = await import("./browser-fixture/router");
    expect(() => router.redirect()).toThrow("Unexpected server redirect");
    expect(() => router.permanentRedirect()).toThrow("Unexpected server redirect");
  });

  it("records component navigation without loading real protected routes", async () => {
    const pushState = vi.fn(), replaceState = vi.fn();
    const assign = vi.fn(), replace = vi.fn();
    vi.stubGlobal("window", { history: { pushState, replaceState }, location: { assign, replace } });
    const { useRouter } = await import("./browser-fixture/router");
    useRouter().push("/en/account");
    useRouter().replace("/en/admin");
    expect(pushState).toHaveBeenCalledWith(null, "", "/en/account");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/en/admin");
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    useRouter().push("/");
    useRouter().replace("/en");
    expect(assign).toHaveBeenCalledWith("/");
    expect(replace).toHaveBeenCalledWith("/en");
  });

  it("runs phone touch and private CSP checks in actual WebKit without a Chromium executable", async () => {
    vi.stubEnv("PLAYWRIGHT_CHROMIUM_EXECUTABLE", "/managed/chromium");
    vi.stubEnv("PLAYWRIGHT_WEBKIT_EXECUTABLE", "");
    const { default: config } = await import("../playwright.production.config");
    expect(config.use?.launchOptions).toBeUndefined();
    const projects = config.projects!;
    for (const width of [320, 390]) {
      const project = projects.find((entry) => entry.name === `webkit-iphone-${width}`)!;
      expect(project).toBeDefined();
      expect(project.use).toMatchObject({
        browserName: "webkit",
        isMobile: true,
        hasTouch: true,
        viewport: { width, height: 844 },
      });
      expect(project.use?.userAgent).toContain("iPhone");
      expect(project.use?.launchOptions?.executablePath).toBe("");
      expect("@phone touch").toMatch(project.grep as RegExp);
      expect("@security private CSP").toMatch(project.grep as RegExp);
      expect("desktop keyboard").not.toMatch(project.grep as RegExp);
    }
    for (const project of projects.filter((entry) => !entry.name?.startsWith("webkit-"))) {
      expect(project.use?.launchOptions?.executablePath).toBe("/managed/chromium");
    }
    expect(config.webServer).toMatchObject({
      command: "pnpm start",
      reuseExistingServer: false,
      env: { PORT: "3200" },
    });
  });

  it("keeps an environment-managed WebKit executable separate from Chromium", async () => {
    vi.stubEnv("PLAYWRIGHT_CHROMIUM_EXECUTABLE", "/managed/chromium");
    vi.stubEnv("PLAYWRIGHT_WEBKIT_EXECUTABLE", "/managed/playwright-webkit/pw_run.sh");
    const { default: config } = await import("../playwright.production.config");
    for (const project of config.projects!) {
      expect(project.use?.launchOptions?.executablePath).toBe(
        project.name?.startsWith("webkit-")
          ? "/managed/playwright-webkit/pw_run.sh"
          : "/managed/chromium",
      );
    }
  });

  it("owns a fresh loopback server instead of reusing an unknown one", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://127.0.0.1:3100");
    expect(config.webServer).toMatchObject({
      reuseExistingServer: false,
      env: { PORT: "3100", PLAYWRIGHT_TEST_SERVER: "1" },
    });
    expect(config.webServer).toHaveProperty("command", expect.stringContaining("tests/search-browser/server.ts"));
    expect(config.metadata).toMatchObject({ publicFixture: true });
  });

  it("uses CI's validated disposable port and public identity, never ambient app targets", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://postgres@127.0.0.1:5432/suhail_test");
    vi.stubEnv("DATABASE_URL_PUBLIC", "postgresql://wrong@untrusted.invalid:6543/wrong");
    const { default: config } = await import("../playwright.config");
    expect(config.webServer).toMatchObject({
      env: {
        DATABASE_URL_TEST: "postgresql://postgres@127.0.0.1:5432/suhail_test",
        DATABASE_URL_PUBLIC: "postgresql://suhail_public@127.0.0.1:5432/suhail_test",
        DATABASE_URL_APP: "",
        PLAYWRIGHT_FIXTURE_MODE: "development",
      },
    });
  });

  it("refuses a hosted test target before starting any server", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://postgres@not-loopback.pooler.supabase.com:5432/suhail_test");
    await expect(import("../playwright.config")).rejects.toThrow("DATABASE_URL_TEST");
  });

  it("assigns every formerly general browser spec to its proper CI configuration", async () => {
    const { default: config } = await import("../playwright.config");
    const general = config.testMatch as string[];
    const smoke = general.map(pattern => pattern.replace("**/", ""));
    const dedicated = [
      ["playwright.ui-one.config.ts", ["ui-one", "ui-two", "ui-three", "ui-four", "ui-five"]],
      ["playwright.ui-eight.config.ts", ["ui-eight"]],
      ["playwright.ui-nine.config.ts", ["ui-nine-admin"]],
      ["playwright.other-methodologies-ui.config.ts", ["other-methodologies-ui"]],
      ["playwright.other-methodologies.config.ts", ["other-methodologies"]],
      ["playwright.stock-ux-five.config.ts", ["stock-ux-five"]],
      ["playwright.accounts.config.ts", ["profile-deadline"]],
    ] as const;
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    for (const [file, names] of dedicated) {
      const configuration = readFileSync(file, "utf8");
      expect(ci.includes(file) || Object.entries(pkg.scripts).some(([name, command]) =>
        command.includes(file) && ci.includes(`pnpm ${name}`))).toBe(true);
      for (const name of names) {
        expect(configuration).toContain(`${name}.spec.ts`);
        expect(smoke).not.toContain(`${name}.spec.ts`);
      }
    }
    const separatelyOwned = new Set([
      "production", "methodology-isr", "hydration", "security", "mobile-menu-navigation",
      ...dedicated.flatMap(([, names]) => names),
    ].map(name => `${name}.spec.ts`));
    const legacyDiscovered = readdirSync("e2e").filter(name =>
      name.endsWith(".spec.ts") && !name.endsWith("-fixture.spec.ts") && !separatelyOwned.has(name));
    expect(smoke.slice().sort()).toEqual(legacyDiscovered.sort());
  });

  it("runs the identical suite against an explicit preview without another server", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://preview.example.test");
    vi.stubEnv("DATABASE_URL_TEST", "not-a-database-url");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("https://preview.example.test");
    expect(config.webServer).toBeUndefined();
    expect(config.metadata).toMatchObject({ publicFixture: false });
    expect(config.use?.trace).toBe("retain-on-failure");
  });

  it("disables persisted dev compiler state for both preview and test servers", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST_SERVER", "1");
    const { default: testConfig } = await import("../next.config");
    expect(testConfig.experimental?.turbopackFileSystemCacheForDev).toBe(false);
    expect(testConfig.experimental?.authInterrupts).toBe(true);
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST_SERVER", "");
    const { default: previewConfig } = await import("../next.config");
    expect(previewConfig.experimental?.turbopackFileSystemCacheForDev).toBe(false);
    expect(previewConfig.experimental?.turbopackFileSystemCacheForBuild).toBeUndefined();
    expect(previewConfig.experimental?.authInterrupts).toBe(true);
    expect(previewConfig.allowedDevOrigins).toEqual(testConfig.allowedDevOrigins);
  });
});
