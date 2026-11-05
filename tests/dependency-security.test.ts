import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const require = createRequire(import.meta.url);
const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");

describe("security dependency resolutions", () => {
  it("copies the override configuration before the Docker frozen install", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    const dependenciesStage = dockerfile
      .split("FROM base AS dependencies")[1]
      .split("FROM dependencies AS builder")[0];
    const beforeInstall = dependenciesStage.split("RUN pnpm install --frozen-lockfile")[0];
    expect(beforeInstall).toContain(
      "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./",
    );
  });

  it("retains the review fixtures needed by the image's TypeScript build", () => {
    const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
    expect(dockerignore.split("\n")).not.toContain("docs");
    for (const fixture of ["arabic-dead-keys.json", "arabic-drafts.json"]) {
      expect(dockerignore.split("\n")).toContain(`!docs/${fixture}`);
    }
  });

  it("does not lock any of the reported vulnerable versions", () => {
    for (const dependency of [
      "esbuild@0.18.20",
      "minimatch@10.2.6",
      "minimatch@3.1.5",
      "zod@4.3.3",
    ]) {
      // Match package/snapshot entries, not the override selector recording
      // which old requests must be redirected.
      expect(lock.slice(lock.indexOf("\npackages:"))).not.toMatch(
        new RegExp(`^  ['"]?${dependency.replaceAll(".", "\\.")}[:('"]`, "m"),
      );
    }
  });

  it("preserves the callable minimatch API required by ESLint and its plugins", () => {
    const configRequire = createRequire(require.resolve("eslint-config-next"));
    for (const parent of ["eslint", "eslint-plugin-react", "eslint-plugin-import"]) {
      const ownerRequire = parent === "eslint" ? require : configRequire;
      const parentRequire = createRequire(ownerRequire.resolve(parent));
      const match = parentRequire("minimatch");
      expect(typeof match).toBe("function");
      expect(match("src/example.ts", "**/*.ts")).toBe(true);
      expect(match("src/example.ts", "**/*.js")).toBe(false);
      const pattern = new match.Minimatch("**/*.{ts,tsx}", { dot: true });
      expect(pattern.match("src/.example.tsx")).toBe(true);
      expect(pattern.match("src/example.js")).toBe(false);
    }
  });

  it("rejects oversized constrained arrays with the patched Zod validator", () => {
    const result = z.array(z.string()).max(2).safeParse(Array(10_000).fill(null));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].code).toBe("too_big");
    }
  });
});
