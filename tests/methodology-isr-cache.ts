import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Next 16 stores on-demand renders in namespaced route-cache directories,
// unlike build-prerendered HTML. Inspect both layouts without guessing hashes.
export function methodologyCacheFiles(locale: string, page: string): string[] {
  const files: string[] = [];
  const suffix = `/${locale}/${page}.html`;
  function visit(directory: string) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (path.endsWith(suffix)) files.push(path);
    }
  }
  visit(".next/server/app");
  visit(".next/server/route-cache");
  return files;
}

export function methodologyCacheFile(locale: string, page: string): string {
  const files = methodologyCacheFiles(locale, page);
  if (files.length !== 1) throw new Error(`Expected one warmed ${locale}/${page} cache entry; found ${files.length}`);
  return files[0];
}
