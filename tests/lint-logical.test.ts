import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
const script = path.resolve("scripts/lint-logical.mjs");

async function lint(source: string, extension = "tsx") {
  const directory = await mkdtemp(path.join(tmpdir(), "suhail-logical-"));
  directories.push(directory);
  await mkdir(path.join(directory, "src"));
  await writeFile(path.join(directory, `src/fixture.${extension}`), source);
  return spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: "utf8",
  });
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe("logical-direction lint", () => {
  it.each([
    "ml-2",
    "mr-2",
    "pl-2",
    "pr-2",
    "left-0",
    "right-0",
    "text-left",
    "text-right",
    "rounded-l",
    "rounded-r-lg",
    "rounded-tl-lg",
    "rounded-tr-lg",
    "rounded-bl-lg",
    "rounded-br-lg",
    "border-l",
    "border-r-2",
    "scroll-ml-2",
    "scroll-mr-2",
    "hover:-ml-2",
  ])("rejects %s and reports the source line", async (utility) => {
    const result = await lint(`export const value = "${utility}";`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/fixture.tsx:1");
  });

  it.each([
    "margin-left",
    "margin-right",
    "padding-left",
    "padding-right",
    "left",
    "right",
  ])("rejects the %s CSS property", async (property) => {
    const result = await lint(`.fixture { ${property}: 0; }`, "css");
    expect(result.status).toBe(1);
  });

  it("accepts logical and direction-neutral utilities", async () => {
    const result = await lint(
      'export const value = "ms-2 me-2 ps-2 pe-2 start-0 end-0 rounded-lg border-ring";',
    );
    expect(result.status).toBe(0);
  });

  it("allows a same-line comment with a reason", async () => {
    const result = await lint(
      'export const value = "ml-2"; // logical-exempt: third-party fixture',
    );
    expect(result.status).toBe(0);
  });

  it("rejects an exemption without a reason", async () => {
    const result = await lint(
      'export const value = "ml-2"; // logical-exempt:',
    );
    expect(result.status).toBe(1);
  });
});
