import { expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
// JS is deliberately runnable with Node alone after a credential-free build.
// @ts-expect-error standalone script has no declaration module
import { detectSensitive, scanBundle } from "../scripts/scan-bundle.mjs";
it.each(["sk-ant-test", "sb_secret_test", "service_role", "postgres://fixture",
  "postgresql://fixture", "DATABASE_URL", "S3_SECRET", "REVALIDATE_SECRET",
  "AKIA0000000000000000", "ASIA0000000000000000"])("detects required sensitive rule %s", value => {
  expect(detectSensitive(value).length).toBeGreaterThan(0);
});
it("does not confuse normal action IDs and public Supabase configuration with secrets", () => {
  expect(detectSensitive('{"node":{"0076a1d6e2d4147ab0b0d3ab091125ed71d37dff72":{"workers":{}}},"edge":{},"encryptionKey":"ZmFrZQ=="} https://fixture.supabase.co sb_publishable_fixture')).toEqual([]);
  expect(detectSensitive('key.startsWith("sb_secret_")')).toEqual([]);
  expect(detectSensitive('key.startsWith("sb_secret_actualValue")')).toEqual(["supabase-secret"]);
  expect(detectSensitive('"sb_secret_"')).toEqual(["supabase-secret"]);
});
it("requires both build inputs and scans nested server manifests without returning secrets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bundle-scan-"));
  try {
    await expect(scanBundle(root)).rejects.toThrow();
    await mkdir(path.join(root,"static"),{recursive:true});
    await mkdir(path.join(root,"server/nested"),{recursive:true});
    await writeFile(path.join(root,"static/app.js"),"normal code");
    await expect(scanBundle(root)).rejects.toThrow();
    await writeFile(path.join(root,"server/nested/server-reference-manifest.json"),'{"secret":"sb_secret_fake_value"}');
    expect(await scanBundle(root)).toEqual([{file:"server/nested/server-reference-manifest.json",rule:"supabase-secret"}]);
    await writeFile(path.join(root,"server/nested/server-reference-manifest.json"),"{}");
    expect(await scanBundle(root)).toEqual([]);
    await mkdir(path.join(root,"standalone/.next/server"),{recursive:true});
    await writeFile(path.join(root,"standalone/.next/server/server-reference-manifest.js"),"REVALIDATE_SECRET");
    expect(await scanBundle(root)).toEqual([{file:"standalone/.next/server/server-reference-manifest.js",rule:"revalidate-secret"}]);
  } finally { await rm(root,{recursive:true,force:true}); }
});
