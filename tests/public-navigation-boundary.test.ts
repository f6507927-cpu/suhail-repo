import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { activeAdminSection } from "../src/lib/auth/admin-navigation";
import { methodologyHref } from "../src/lib/methodology/navigation";

describe("Public rendering dependency boundary (D-20/D-22/D-51)", () => {
  it("traverses public routes and the complete local header graph, including re-exports and dynamic imports", () => {
    const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
    const visited = new Set<string>();
    const violations: string[] = [];
    function visit(file: string) {
      file = path.resolve(file);
      if (visited.has(file)) return;
      visited.add(file);
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function dependency(module: string) {
        if (/\.(css|woff2?|svg|png)$/.test(module)) return;
        if (module === "next/headers" || /lib\/auth\/(?:guards|server)$/.test(module) || /db\/app$/.test(module)) {
          violations.push(`${file} -> ${module}`);
        }
        if (!module.startsWith(".") && !module.startsWith("@/")) return;
        const target = ts.resolveModuleName(module, file, options, ts.sys).resolvedModule?.resolvedFileName;
        expect(target, `${file} -> ${module}`).toBeTruthy();
        if (target && !target.includes("node_modules") && !target.endsWith(".json")) visit(target);
      }
      function walk(node: ts.Node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          if (!node.importClause?.isTypeOnly) dependency(node.moduleSpecifier.text);
        }
        if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
        if (ts.isCallExpression(node)) {
          if (ts.isIdentifier(node.expression) && ["cookies", "headers"].includes(node.expression.text)) violations.push(`${file}: request read`);
          if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) dependency(node.arguments[0].text);
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
    function routes(directory: string) {
      for (const entry of readdirSync(directory, {withFileTypes:true})) {
        const file=path.join(directory, entry.name);
        if (entry.isDirectory()) routes(file);
        else if (file.endsWith(".tsx")) visit(file);
      }
    }
    routes("src/app/[locale]/(public)");
    visit("src/app/global-not-found.tsx");
    expect([...visited].some(file=>file.endsWith("/SiteHeader.tsx"))).toBe(true);
    expect([...visited].some(file=>file.endsWith("/AccountControl.tsx"))).toBe(true);
    expect(violations).toEqual([]);
  });
});

describe("Admin hierarchy links", () => {
  it.each(["/admin", "/en/admin", "/admin/methodologies", "/en/admin/methodologies/a/versions/b?panel=criteria", "/admin/methodologies/"])("marks just the methodology section for %s", input => {
    expect(activeAdminSection(input)).toBe("/admin");
  });
  it.each(["users","settings","audit","securities"])("marks only %s for descendants", section => {
    expect(activeAdminSection(`/en/admin/${section}/detail`)).toBe(`/admin/${section}`);
  });
  it("links to existing routes and encodes selection without a second locale prefix", () => {
    expect(methodologyHref("en",{methodology:"parent",version:"child"},"criteria-record"))
      .toBe("/en/admin/methodologies?methodology=parent&version=child#criteria-record");
    expect(methodologyHref("ar")).toBe("/admin/methodologies");
  });
});
