export const productionFixture = process.env.PLAYWRIGHT_PRODUCTION_FIXTURE === "1";
export const productionRoot = productionFixture ? "generated-artifacts/next-production-browser" : ".";
export const fixtureStart = (mode: string) => `pnpm exec tsx tests/production-browser/runner.ts ${mode}`;
