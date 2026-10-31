import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("browser runner isolation", () => {
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
  });

  it("runs the identical suite against an explicit preview without another server", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://preview.example.test");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("https://preview.example.test");
    expect(config.webServer).toBeUndefined();
    expect(config.use?.trace).toBe("retain-on-failure");
  });

  it("disables persisted compiler state only for the self-managed test server", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST_SERVER", "1");
    const { default: testConfig } = await import("../next.config");
    expect(testConfig.experimental?.turbopackFileSystemCacheForDev).toBe(false);
    expect(testConfig.experimental?.authInterrupts).toBe(true);
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST_SERVER", "");
    const { default: previewConfig } = await import("../next.config");
    expect(previewConfig.experimental?.turbopackFileSystemCacheForDev).toBeUndefined();
    expect(previewConfig.experimental?.authInterrupts).toBe(true);
    expect(previewConfig.allowedDevOrigins).toEqual(testConfig.allowedDevOrigins);
  });
});
