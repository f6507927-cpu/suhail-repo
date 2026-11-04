import { defineConfig } from "@playwright/test";
import searchConfig from "./playwright.search.config";
const server=searchConfig.webServer;
if(!server || Array.isArray(server))throw new Error("Expected the isolated fixture server");
export default defineConfig({
  ...searchConfig, testMatch:"**/stock-ux-five.spec.ts",
  outputDir:"generated-artifacts/playwright-stock-ux-five",
  webServer:{...server,env:{...server.env,PLAYWRIGHT_FIXTURE_MODE:"development"}},
});
