import { defineConfig } from "@playwright/test";
import homeConfig from "./playwright.home.config";
export default defineConfig({...homeConfig,testMatch:"**/motion-fixture.spec.ts",outputDir:"generated-artifacts/playwright-motion"});
