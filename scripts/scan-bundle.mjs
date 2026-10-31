import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Report only rule and relative filename. Never print matched bytes or excerpts.
export const sensitivePatterns = [
  ["anthropic", /sk-ant/i], ["supabase-secret", /sb_secret/i],
  ["service-role", /service_role/i], ["postgres-uri", /postgres(?:ql)?:\/\//i],
  ["database-variable", /DATABASE_URL/i], ["s3-secret", /S3_SECRET/i],
  ["revalidate-secret", /REVALIDATE_SECRET/i],
  ["aws-access-key", /(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}/],
];
export function detectSensitive(content) {
  // The installed Supabase SDK classifies key formats with this exact inert
  // prefix test. Exempt the expression, never a key value, file or vendor chunk.
  const inspected = content.replace(/\.startsWith\((["'])sb_secret_\1\)/g, '.startsWith("inert-prefix")');
  return sensitivePatterns.filter(([, pattern]) => pattern.test(inspected)).map(([name]) => name);
}
async function filesIn(directory, skipDirectories = []) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error("Symlink in bundle inputs");
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && skipDirectories.includes(entry.name)) continue;
    if (entry.isDirectory()) files.push(...await filesIn(filename, skipDirectories));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}
export async function scanBundle(root = ".next") {
  const statics = await filesIn(path.join(root, "static"));
  // Include packaged/standalone copies too, not only .next/server. Dependency
  // trees and compiler caches are not deployable action manifests.
  const buildFiles = await filesIn(root, ["node_modules", "cache"]);
  const manifests = buildFiles.filter(filename => /server-reference-manifest\.(?:json|js)$/.test(filename));
  if (!statics.length || !manifests.length) throw new Error("Required build scan inputs missing");
  const violations = [];
  for (const filename of [...statics, ...manifests]) {
    for (const rule of detectSensitive(await readFile(filename, "utf8"))) {
      violations.push({file: path.relative(root, filename), rule});
    }
  }
  return violations;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const violations = await scanBundle(process.argv[2]);
    for (const {file, rule} of violations) console.error(`Sensitive bundle pattern: ${rule} in ${file}`);
    if (violations.length) process.exitCode = 1;
    else console.log("Bundle secret scan passed");
  } catch {
    console.error("Bundle secret scan failed: required build inputs unavailable or unreadable");
    process.exitCode = 1;
  }
}
