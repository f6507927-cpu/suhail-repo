import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { checkRegister } from "../src/lib/copy-register";
import { SearchResults } from "../src/components/search/SearchResults";
import { Disclaimer } from "../src/components/foundation/Disclaimer";
import { EmptyState } from "../src/components/foundation/EmptyState";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
const requestedBans = (text: string, locale: "ar" | "en") =>
  checkRegister(text, locale).hardBans.filter(term => /^(recommendation|advice|should buy)$/i.test(term));
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
}

describe("public copy, not only dictionaries (D-120 exact disclaimers retained)", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`${locale} dictionaries and rendered empty/results/disclaimer text honor the register`, () => {
      const messages = locale === "ar" ? ar : en;
      for (const text of strings(messages)) expect(requestedBans(text, locale), text).toEqual([]);
      const markup = renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <SearchResults locale={locale} valid results={[]} />
        <SearchResults locale={locale} valid={false} results={[]} />
        <EmptyState title={messages.controls.emptyTitle}>{messages.controls.emptyBody}</EmptyState>
        <Disclaimer variant="short" /><Disclaimer variant="full" />
      </NextIntlClientProvider>);
      const text = markup.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
      expect(requestedBans(text, locale)).toEqual([]);
      expect(requestedBans(`${messages.disclaimer.full} Unapproved recommendation`, locale)).toEqual(["recommendation"]);
      expect(requestedBans(messages.disclaimer.full.replace("application", "site") + " advice", locale)).not.toEqual([]);
    });
  }
  it("walks public route imports/re-exports for hard-coded/shared strings and JSX text", () => {
    const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
    const visited = new Set<string>();
    const violations: string[] = [];
    function visit(file: string) {
      file = path.resolve(file);
      if (visited.has(file) || file.endsWith(".json") || file.includes("node_modules")) return;
      visited.add(file);
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function walk(node: ts.Node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const specifier = node.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier) && (specifier.text.startsWith(".") || specifier.text.startsWith("@/")) &&
            !/\.(css|woff2?|svg|png)$/.test(specifier.text)) {
            const target = ts.resolveModuleName(specifier.text, file, options, ts.sys).resolvedModule?.resolvedFileName;
            if (target) visit(target);
          }
        } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
          // The register's pattern definitions are policy, not rendered copy.
          if (!file.endsWith("/copy-register.ts") && requestedBans(node.text.trim(), "en").length)
            violations.push(`${path.relative(process.cwd(), file)}: ${node.text.trim()}`);
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
    function routes(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const name = path.join(directory, entry.name);
        if (entry.isDirectory()) routes(name);
        else if (name.endsWith(".tsx")) visit(name);
      }
    }
    routes("src/app/[locale]/(public)");
    visit("src/app/global-not-found.tsx");
    expect([...visited].some(f => f.endsWith("/SiteHeader.tsx"))).toBe(true);
    expect([...visited].some(f => f.endsWith("/StockVerdictParts.tsx"))).toBe(true);
    expect(violations).toEqual([]);
  });
});
