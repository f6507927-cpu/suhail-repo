import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";

const eslint = new ESLint();

// Tooling bootstrap, not a behavior test: concurrent completion checks can make
// Next/TypeScript ESLint's cold plugin/config load exceed Vitest's 5s test limit.
// Keep the actual boundary assertions on their normal timeout.
beforeAll(async () => {
  await eslint.lintText("export const fixture = 0;", {
    filePath: path.resolve("src/engine/fixture.ts"),
  });
}, 30_000);

async function restrictionCount(file: string, importedPath: string) {
  const [result] = await eslint.lintText(
    `import value from "${importedPath}"; export default value;`,
    { filePath: path.resolve(file) },
  );
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-imports",
  ).length;
}

describe("import boundaries", () => {
  it.each(["@/db/schema", "../db/schema", "node:fs", "node:http", "postgres", "../../scripts/db/fixtures", "./__fixtures__/synthetic"])(
    "rejects IO/database/test coupling %s in engine production modules",
    async (importedPath) => {
      expect(await restrictionCount("src/engine/fixture.ts", importedPath)).toBeGreaterThan(0);
    },
  );
  it.each(["./types", "../math", "node:crypto", "zod"])(
    "allows pure engine dependency %s", async (importedPath) => {
      expect(await restrictionCount("src/engine/fixture.ts", importedPath)).toBe(0);
    },
  );
  it.each([
    "Date.now()", "new Date()", "Date()", "Math.random()", "fetch('/test')", "process.env.SECRET",
    "setTimeout(() => {}, 1)", "performance.now()",
    "import { randomUUID } from 'node:crypto'; randomUUID()",
    "import { createHash } from 'node:crypto'; createHash('md5')",
  ])("rejects impure engine code %s", async (code) => {
    const [result] = await eslint.lintText(`${code};`, { filePath: path.resolve("src/engine/fixture.ts") });
    expect(result.messages.some((m) => m.ruleId === "no-restricted-syntax")).toBe(true);
  });
  it("allows supplied-date calculations and SHA-256", async () => {
    const [result] = await eslint.lintText(
      "import { createHash } from 'node:crypto'; export const hash = createHash('sha256'); export const date = new Date('2026-01-01');",
      { filePath: path.resolve("src/engine/fixture.ts") },
    );
    expect(result.messages).toEqual([]);
  });
  it.each(["../../../db/app", "../../../../db/app", "@/db/app"])("public rejects %s", async imported =>
    expect(await restrictionCount("src/app/[locale]/(public)/fixture.ts",imported)).toBe(1));
  it.each(["src/app/[locale]/(private)/account/fixture.ts","src/app/[locale]/(private)/auth/fixture.ts","src/app/[locale]/admin/fixture.ts"])("does not allow jobs in %s",async file =>
    expect(await restrictionCount(file,"../../jobs/weekly")).toBe(1));
  it("rejects the app database client in public routes", async () => {
    expect(
      await restrictionCount(
        "src/app/[locale]/(public)/fixture.ts",
        "@/db/app",
      ),
    ).toBe(1);
  });

  it.each(["@/jobs/weekly", "../../jobs/weekly"])(
    "rejects %s outside jobs and admin",
    async (importedPath) => {
      expect(await restrictionCount("tests/fixture.ts", importedPath)).toBe(1);
      expect(await restrictionCount("src/lib/fixture.ts", importedPath)).toBe(
        1,
      );
      expect(
        await restrictionCount(
          "src/app/[locale]/(public)/fixture.ts",
          importedPath,
        ),
      ).toBe(1);
    },
  );

  it.each(["src/jobs/fixture.ts", "src/app/[locale]/(private)/admin/fixture.ts"])(
    "allows job imports in %s",
    async (file) => {
      expect(await restrictionCount(file, "@/jobs/weekly")).toBe(0);
    },
  );
});
