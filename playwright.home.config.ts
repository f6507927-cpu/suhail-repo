import { defineConfig } from "@playwright/test";
import searchConfig from "./playwright.search.config";
const server=searchConfig.webServer;
if(!server || Array.isArray(server))throw new Error("Expected isolated fixture server");
export default defineConfig({
  ...searchConfig,testMatch:"**/home-fixture.spec.ts",
  outputDir:"generated-artifacts/playwright-home",
  webServer:{...server,command:"pnpm exec tsx --conditions=react-server tests/home-browser/setup.ts && pnpm exec tsx tests/search-browser/server.ts",
    env:{...server.env,PLAYWRIGHT_FIXTURE_MODE:"development",PUBLIC_MEDIA_BASE_URL:"https://media.fixture.invalid/assets/"}},
});
