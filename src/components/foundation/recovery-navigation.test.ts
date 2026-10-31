import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const recovery = readFileSync(new URL("./RecoveryDocumentClient.tsx", import.meta.url), "utf8");
const document = readFileSync(new URL("./RecoveryDocument.tsx", import.meta.url), "utf8");

describe("provider-independent recovery", () => {
  it("includes both locale homes, brand shell, fonts, and theme boot in the root document", () => {
    expect(recovery).toContain('href="/" lang="ar"');
    expect(recovery).toContain('href="/en" lang="en"');
    expect(recovery).toContain("<BrandMark surface=\"dark\"");
    expect(recovery).toContain("<header className=\"surface-dark");
    expect(recovery).toContain("<footer className=");
    expect(recovery).toContain('src="/theme-restore.js"');
    expect(recovery).toContain("<title>{documentTitle}</title>");
    expect(recovery).not.toContain("useLocale");
    expect(recovery).not.toContain("Lockup");
    expect(recovery).toContain("--font-arabic");
    expect(recovery).toContain("--font-latin");
    expect(recovery).toContain("--font-numbers");
    expect(document).not.toContain("next/font");
  });

  it("uses browser pathname only and gives not-found/error distinct localized titles", () => {
    expect(recovery).toContain("window.location.pathname");
    expect(recovery).toContain("kind === \"not-found\"");
    expect(recovery).toContain("Page not found");
    expect(recovery).toContain("This page could not be loaded.");
    expect(recovery).not.toContain("headers()");
    expect(recovery).not.toContain("cookies()");
  });
});
