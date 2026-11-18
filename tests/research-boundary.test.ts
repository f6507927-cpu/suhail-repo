import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { assertOfflineResearch } from "../src/ai/research/offline";
import { fixturePackets } from "./fixtures/research/packets";
import { assembleDraft } from "../src/ai/research/draft";
import { handwrittenModel } from "./fixtures/research/outputs";
import { validateResearchDraft } from "../src/ai/research/validators";

describe("P1 fixture-only boundary", () => {
  it("refuses real provider clients and credential names, without reading secret values", () => {
    expect(() => assertOfflineResearch(Object.keys(process.env))).not.toThrow();
    for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"])
      expect(() => assertOfflineResearch([name])).toThrow("API keys");
    expect(() => assertOfflineResearch([], "anthropic")).toThrow("fixture");
    expect(() => assertOfflineResearch(["DATABASE_URL_APP"])).not.toThrow();
  });
  it("has no transitive provider, database, environment, IO, timer or ambient-clock dependency", () => {
    const visited = new Set<string>(), errors: string[] = [];
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      if (file.endsWith(".json")) return;
      const text = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      function inspect(node: ts.Node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return;
          const specifier = node.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier)) {
            const name = specifier.text;
            if (name === "node:crypto" || name === "zod") return;
            if (!name.startsWith(".") && !name.startsWith("@/")) errors.push(`${file}: external import ${name}`);
            else {
              const path = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(file), name);
              if (/\/(?:db|jobs|env|ingest)\//.test(path)) errors.push(`${file}: IO import ${name}`);
              const dependency = [path, `${path}.ts`, `${path}.tsx`, `${path}.json`, `${path}/index.ts`].find(p => existsSync(p));
              if (!dependency) errors.push(`${file}: unresolved import ${name}`);
              else visit(dependency);
            }
          }
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) errors.push(`${file}: dynamic import`);
        if (ts.isIdentifier(node) && /^(?:fetch|process|setTimeout|setInterval|XMLHttpRequest|WebSocket)$/.test(node.text)
          && !(node.text === "process" && file.endsWith("/scripts/research/evaluate.ts")))
          errors.push(`${file}: ambient IO ${node.text}`);
        if (ts.isCallExpression(node) && /^(?:Date\.now|Math\.random|Date)$/.test(node.expression.getText(ast))) errors.push(`${file}: ambient clock/random`);
        if (ts.isNewExpression(node) && node.expression.getText(ast) === "Date" && !node.arguments?.length) errors.push(`${file}: ambient Date`);
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
    for (const file of readdirSync("src/ai/research").filter(f => f.endsWith(".ts"))) visit(resolve("src/ai/research", file));
    // The CLI may inspect credential names / set an exit code, but must not gain
    // a provider or database import path around the pure library.
    visit(resolve("scripts/research/evaluate.ts"));
    expect(errors).toEqual([]);
    expect(visited.size).toBeGreaterThan(10);
  });
  it("evaluates entirely with network disabled", () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("Network forbidden in research fixtures"); };
    try {
      for (const packet of fixturePackets) {
        const draft = assembleDraft(handwrittenModel(packet), packet);
        expect(validateResearchDraft(draft, packet, { now: packet.built_at, max_packet_age_days: 30,
          max_financial_age_days: 550, known_issuers: [] })).toEqual([]);
      }
    } finally { globalThis.fetch = original; }
  });
});
