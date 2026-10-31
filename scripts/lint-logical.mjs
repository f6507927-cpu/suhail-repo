import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("src");
const extensions = new Set([".ts", ".tsx", ".css"]);
const physicalClass =
  /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-[^\s"'`]+|text-(?:left|right)|rounded-(?:tl|tr|bl|br|l|r)(?:-[^\s"'`]+)?|border-(?:l|r)(?:-[^\s"'`]+)?|scroll-m(?:l|r)-[^\s"'`]+)(?![\w-])/;
const physicalCss =
  /\b(?:margin-left|margin-right|padding-left|padding-right|left|right)\s*:/;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const violations = [];
for (const file of await collectFiles(sourceRoot)) {
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/(?:\/\/|\/\*)\s*logical-exempt:\s*[^\s*]/.test(line)) {
      return;
    }

    if (physicalClass.test(line) || physicalCss.test(line)) {
      violations.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Physical-direction utilities or CSS properties found:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
} else {
  console.log("No physical-direction classes or CSS properties found.");
}
