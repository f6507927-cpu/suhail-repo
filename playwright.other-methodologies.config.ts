import { defineConfig } from "@playwright/test";
import searchConfig from "./playwright.search.config";
const server = searchConfig.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected the isolated fixture server");
// D-174: real Next routes on disposable PostgreSQL; synthetic EX-B as a second methodology.
export default defineConfig({
  ...searchConfig, testMatch: "**/other-methodologies.spec.ts",
  outputDir: "generated-artifacts/playwright-other-methodologies",
  webServer: { ...server, command: "pnpm exec tsx --conditions=react-server tests/search-browser/setup.ts && " +
    "pnpm exec tsx --conditions=react-server tests/other-methodologies-browser/setup.ts && pnpm exec tsx tests/search-browser/server.ts" },
});
