import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { relative } from "node:path";
import { Node, Project, SyntaxKind, type Type } from "ts-morph";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";

export const marker = "⟦AR-REVIEW⟧ ";
type Tree = { [key: string]: string | Tree };
export type Entry = {
  id: string; key: string; source: string; group: string;
  contexts: string[]; category: string;
};
type Draft = { source: string; draft: string; category?: string };
export function leaves(tree: Tree, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : Object.entries(leaves(value, path));
  }));
}
function finiteType(type: Type): string[] {
  if (type.isStringLiteral()) return [type.getLiteralValue() as string];
  if (type.isUnion()) return type.getUnionTypes().flatMap(finiteType);
  return [];
}
function values(node: Node | undefined): string[] {
  if (!node) return [];
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralText()];
  if (Node.isJsxExpression(node)) return values(node.getExpression());
  if (Node.isConditionalExpression(node)) return [...values(node.getWhenTrue()), ...values(node.getWhenFalse())];
  return finiteType(node.getType());
}
const categoryFor = (source: string, key: string) =>
  source.length > 80 || /[.!?]$/.test(source) ||
    /help|hint|note|intro|confirm|unavailable|no[A-Z]|invalid/i.test(key) ? "help/error" : "UI label";
export const phraseId = (source: string) =>
  `U-${createHash("sha256").update(source).digest("hex")}`;
const readTree = (locale: string): Tree =>
  JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, "utf8"));

export function discover(options: {
  extraSources?: Record<string, string>;
  english?: Record<string, string>; arabic?: Record<string, string>;
} = {}) {
  const en = options.english ?? leaves(readTree("en")), ar = options.arabic ?? leaves(readTree("ar"));
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  for (const [path, content] of Object.entries(options.extraSources ?? {})) {
    project.createSourceFile(path, content, { overwrite: true });
  }
  const sources = project.getSourceFiles().filter((file) => {
    const path = file.getFilePath();
    return path.includes("/src/") && /\.[jt]sx?$/.test(path) && !path.includes("node_modules") && !/\.test\./.test(path);
  });
  const usage = new Map<string, Set<string>>();
  const phrases = new Map<string, Set<string>>();
  const unresolved = new Set<string>();
  const add = (map: Map<string, Set<string>>, key: string, context: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(context); map.set(key, set);
  };
  const errors: string[] = [];
  for (const file of sources) {
    const path = relative(process.cwd(), file.getFilePath());
    const context = (node: Node, mode = "Rendered/conditionally rendered") =>
      `${mode}: ${path}:${node.getStartLineNumber()}`;
    const keyUse = (key: string, node: Node, mode?: string) => {
      if (!(key in en)) errors.push(`Missing English counterpart: ${key} (${context(node)})`);
      else add(usage, key, context(node, mode));
    };
    const dictionaries = new Set(file.getImportDeclarations()
      .filter((node) => !node.isTypeOnly() && /messages\/(?:en|ar)\.json$/.test(node.getModuleSpecifierValue()))
      .map((node) => node.getDefaultImport()?.getText()).filter(Boolean));
    const dictionaryPaths = (node: Node): string[] | null => {
      if (Node.isIdentifier(node) && dictionaries.has(node.getText())) return [""];
      if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
        const base = dictionaryPaths(node.getExpression());
        if (!base) return null;
        const suffix = Node.isPropertyAccessExpression(node) ? [node.getName()] : values(node.getArgumentExpression());
        return base.flatMap((prefix) => suffix.map((key) => prefix ? `${prefix}.${key}` : key));
      }
      return null;
    };
    if (!path.endsWith("/GovernedCopy.tsx")) {
      for (const node of [...file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
        ...file.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)]) {
        const parent = node.getParent();
        if ((Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent)) &&
          parent.getExpression() === node) continue;
        const paths = dictionaryPaths(node);
        if (!paths) continue;
        for (const key of paths) {
          if (key in en) keyUse(key, node, "Rendered/conditionally rendered: direct dictionary access");
          else {
            unresolved.add(`Whole dictionary/namespace consumer: ${context(node)} ${node.getText()}`);
            Object.keys(en).filter((leaf) => !key || leaf.startsWith(`${key}.`))
              .forEach((leaf) => keyUse(leaf, node, "Unresolved whole namespace; retained, needs audit"));
          }
        }
        if (!paths.length) {
          unresolved.add(`Unresolved direct dictionary lookup: ${context(node)} ${node.getText()}`);
          Object.keys(en).forEach((key) => keyUse(key, node, "Unresolved direct dictionary; retained, needs audit"));
        }
      }
    }
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      const name = expr.getText();
      // Resolve the actual translator binding, not a global regex for "t".
      const declaration = expr.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
      const initializer = declaration?.getInitializer();
      const factory = initializer && (Node.isCallExpression(initializer) ? initializer :
        initializer.getFirstDescendantByKind(SyntaxKind.CallExpression));
      if (factory && /^(useTranslations|getTranslations)$/.test(factory.getExpression().getText())) {
        const arg = factory.getArguments()[0];
        let namespace = "";
        if (arg && Node.isStringLiteral(arg)) namespace = arg.getLiteralText();
        if (arg && Node.isObjectLiteralExpression(arg)) {
          const property = arg.getProperty("namespace");
          if (property && Node.isPropertyAssignment(property)) namespace = values(property.getInitializer())[0] ?? "";
        }
        // MethodologyCopy is an adapter, not evidence that every public key is live.
        if (path.endsWith("/MethodologyCopy.tsx")) continue;
        const argument = call.getArguments()[0];
        // The styleguide's local label(key: string) forwards a template.
        // Its finite literal callers, not the broad string type, prove use.
        if (path.endsWith("/styleguide/page.tsx") && argument?.getText() === "`styleguide.${key}`") continue;
        const keys = values(argument);
        if (!keys.length) {
          unresolved.add(`Unresolved translator: ${context(call)} ${call.getText()}`);
          // Preserve the namespace until a human resolves the dynamic surface.
          Object.keys(en).filter((key) => !namespace || key.startsWith(`${namespace}.`))
            .forEach((key) => keyUse(key, call, "Unresolved dynamic namespace; retained, needs audit"));
        } else keys.forEach((key) => keyUse(namespace ? `${namespace}.${key}` : key, call));
      }
      if (name === "label" && path.endsWith("/styleguide/page.tsx")) {
        values(call.getArguments()[0]).forEach((key) => keyUse(`styleguide.${key}`, call, "Rendered: development styleguide"));
      }
      if (name === "governedText" && !path.endsWith("/GovernedCopy.tsx")) {
        const arg = call.getArguments()[1];
        // successKey is forwarded by run(); enumerate its concrete call sites below.
        if (arg?.getText() !== "successKey") {
          values(arg).forEach((key) => keyUse(`governed.${key}`, call));
        }
      }
      if (name === "run" && path.endsWith("/AdminMethodologies.tsx")) {
        const arg = call.getArguments()[1];
        (arg ? values(arg) : ["saved"]).forEach((key) => keyUse(`governed.${key}`, call, "Conditionally rendered: successful admin action feedback"));
      }
      if (name === "reviewText" && !path.endsWith("/types.ts")) {
        const arg = call.getArguments()[1];
        values(arg).forEach((source) => {
          if (!approvedArabicCopy[source]) add(phrases, source, context(call));
        });
      }
      // Finite callers of local presentation wrappers also count. A registry
      // can omit a newly added conditional label; broad forwarding is not proof
      // that the caller was discovered.
      const wrapper = expr.getSymbol()?.getDeclarations().find(Node.isFunctionDeclaration);
      if (wrapper && wrapper.getReturnType().isString() && wrapper.getDescendantsOfKind(SyntaxKind.CallExpression)
        .some(node => node.getExpression().getText() === "reviewText")) {
        values(call.getArguments()[1]).forEach(source => {
          if (!approvedArabicCopy[source]) add(phrases, source, context(call));
        });
      }
      if (name === "reviewError") {
        const arg = call.getArguments()[1];
        if (arg) for (const node of [arg, ...arg.getDescendants()]) {
          if (Node.isStringLiteral(node)) add(phrases, node.getLiteralText(), context(call, "Conditionally rendered: admin action failure"));
        }
      }
      if (path.includes("/lib/methodology/")) {
        const arg = name === "requireGate" ? call.getArguments()[1] :
          name === "issue" ? call.getArguments()[0] : undefined;
        values(arg).forEach((source) => add(phrases, source, context(call, "Conditionally rendered: methodology review-error via action result")));
      }
    }
    for (const declaration of file.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const initializer = declaration.getInitializer();
      if (declaration.getName() === "run" && Node.isArrowFunction(initializer) &&
        path.endsWith("/AdminMethodologies.tsx")) {
        values(initializer.getParameters()[1]?.getInitializer()).forEach((key) =>
          keyUse(`governed.${key}`, declaration, "Conditionally rendered: run() default success feedback"));
      }
    }
    for (const property of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (property.getName() === "error" && (path.includes("/lib/methodology/") ||
        path.endsWith("/methodology-actions.ts"))) {
        values(property.getInitializer()).forEach((source) =>
          add(phrases, source, context(property, "Conditionally rendered: report/action error fallback")));
      }
    }
    if (path === "src/lib/methodology/reports.ts") {
      const adapter = file.getFunction("executionError");
      for (const returned of adapter?.getDescendantsOfKind(SyntaxKind.ReturnStatement) ?? []) {
        values(returned.getExpression()).forEach((source) =>
          add(phrases, source, context(returned, "Conditionally rendered: report execution failure")));
      }
    }
    for (const element of [...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)]) {
      const name = element.getTagNameNode().getText();
      const namespace = name === "MethodologyCopy" ? "publicMethodology" :
        ["GovernedCopy", "TextField", "TextArea", "SelectField", "CheckSet", "Meta"].includes(name) &&
          path.includes("/methodology/") ? "governed" : null;
      if (!namespace) continue;
      const attr = element.getAttribute(["GovernedCopy", "MethodologyCopy"].includes(name) ? "id" : "label");
      if (!attr || !Node.isJsxAttribute(attr)) continue;
      const arg = attr.getInitializer();
      // Typed forwarding props have a broad keyof type; their concrete callers
      // are inventoried at the label/id attribute instead.
      if (["{label}", "{id}"].includes(arg?.getText() ?? "")) continue;
      values(arg).forEach((key) => keyUse(`${namespace}.${key}`, attr));
    }
    // Explicit runtime markers (including finite navigation fallback phrases).
    for (const node of file.getDescendants()) {
      if (Node.isTemplateExpression(node) && node.getHead().getLiteralText().includes(marker) &&
        !["src/components/methodology/GovernedCopy.tsx", "src/components/methodology/AdminMethodologies.tsx",
          "src/components/accounts/types.ts", "src/i18n/presentation.ts"].includes(path)) {
        errors.push(`Unresolved runtime marker constructor: ${context(node)} ${node.getText()}`);
      }
      if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
        const value = node.getLiteralText();
        if (value.startsWith(marker) && value.length > marker.length) {
          add(phrases, value.slice(marker.length), context(node));
        }
        // Safe, concrete errors only; arbitrary exception messages stay unbounded.
        const parent = node.getParent();
        // These two concrete generic fallbacks can reach the methodology action's
        // inner catch. Other auth failures before the action redirect/refuse entry.
        if ((path === "src/lib/auth/errors.ts" && value === "operation_failed") ||
          (path === "src/lib/auth/actions.ts" && value === "role_required")) {
          add(phrases, value, context(node, "Conditionally rendered: admin action recheck/failure"));
        }
        if (parent && Node.isNewExpression(parent) && /GovernanceError$/.test(parent.getExpression().getText())) {
          add(phrases, value, context(node, "Conditionally rendered: governance refusal"));
        }
      }
    }
  }
  const groupFor = (contexts: string[]) => {
    const text = contexts.join(" ");
    if (/\/methodology\/|\/lib\/methodology\/|methodology-actions|admin action/.test(text)) {
      return /AdminMethodologies|MethodologyForms|MethodologyReports|\/lib\/methodology\/|methodology-actions|admin action/.test(text)
        ? "Admin methodology — /admin/methodologies" : "Public methodology — /methodology and /methodology/[slug]";
    }
    if (/styleguide/.test(text)) return "Development styleguide — /styleguide (404 in production)";
    if (/accounts|\/\(private\)\//.test(text)) return "Accounts and administration — private routes";
    return "Shared public shell and foundation samples";
  };
  const entries: Entry[] = [];
  for (const [key, contexts] of usage) {
    const current = ar[key];
    if (current === undefined) errors.push(`Missing Arabic counterpart: ${key}`);
    if (!current?.includes(marker)) continue;
    const sorted = [...contexts].sort();
    entries.push({ id: `J-${key.replaceAll(".", "-")}`, key, source: en[key],
      contexts: sorted, group: groupFor(sorted), category: categoryFor(en[key], key) });
  }
  // Preserve historical phrase IDs if a formerly approved source ever becomes
  // unapproved again, without using mutable draft mappings to decide liveness.
  const baseline = JSON.parse(readFileSync("tests/fixtures/arabic-approval-baseline.json", "utf8")) as { rows: string[][] };
  for (const [source, contexts] of phrases) {
    if (approvedArabicCopy[source]) continue;
    const previous = baseline.rows.find((row) => row[3] === source && /^[AFEI]-/.test(row[0]));
    const sorted = [...contexts].sort();
    entries.push({ id: previous?.[0] ?? phraseId(source), key: "runtime phrase", source,
      contexts: sorted, group: groupFor(sorted), category: "help/error" });
  }
  for (const kind of ["terms", "privacy"]) {
    const path = `content/legal/${kind}.ar.md`;
    const body = readFileSync(path, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
    if (body.includes(marker.trim())) entries.push({
      id: `L-${kind}-body`, key: path, source: body.replace("⟦LEGAL-REVIEW⟧", "").replace(marker.trim(), "").trim(),
      contexts: [`Rendered: /${kind}, /en/${kind}; LegalDocument body; O-7 unresolved`],
      group: `Legal pages — /terms and /privacy`, category: "legal document",
    });
  }
  // Engine templates are currently fully approved. Future marked templates fail
  // visibly rather than being silently omitted by a JSON-only scan.
  for (const file of sources.filter((file) => file.getFilePath().includes("/engine/reasons/"))) {
      if (file.getText().includes(marker)) errors.push(`Marked engine template needs a concrete E-ID adapter: ${file.getBaseName()}`);
  }
  entries.sort((a, b) => a.group.localeCompare(b.group, "en") || a.id.localeCompare(b.id, "en"));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) errors.push("Duplicate stable review IDs");
  return { entries, usage, en, ar, unresolved: [...unresolved].sort(), errors,
    unused: Object.keys(en).filter((key) => !usage.has(key)).sort() };
}

export const escapeCell = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("|", "&#124;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>");
const proposals = JSON.parse(readFileSync("docs/arabic-draft-proposals.json", "utf8")) as Record<string, string>;
export function draftFor(entry: Entry, drafts: Record<string, Draft>) {
  // D-139: supplied Arabic is the draft/source, not legally approved text.
  if (entry.id.startsWith("L-")) return entry.source;
  // D-103–D-106 supersede only documentation drafts, never runtime approvals.
  if (["Edge cases", "Verified by", "Available in production", "Not enabled for production",
    "Production status", "Enable for production", "Enable production", "Borderline margin"].includes(entry.source)) {
    return proposals[entry.source];
  }
  const saved = drafts[entry.id];
  // D-138: preserve genuine exact-source drafts, not English placeholders.
  const retained = saved?.source === entry.source ? saved.draft : undefined;
  return retained && !draftGap(entry, retained) ? retained :
    proposals[entry.source] ?? retained ?? "DRAFT REQUIRED — not approved";
}
export function draftGap(entry: Entry, draft: string | undefined): string | null {
  if (entry.id.startsWith("L-")) return null; // O-7: no invented legal text.
  if (!draft?.trim()) return "empty or missing";
  if (/DRAFT REQUIRED|needs O-7 text|⟦AR-REVIEW⟧|⟦LEGAL-REVIEW⟧/i.test(draft)) return "placeholder";
  if (draft.trim() === entry.source.trim()) return "source-identical";
  if (!/\p{Script=Arabic}/u.test(draft)) return "no Arabic proposal";
  return null;
}
export function assertDrafts(entries: Entry[], drafts: Record<string, Draft>) {
  const gaps = entries.flatMap(entry => {
    const gap = draftGap(entry, draftFor(entry, drafts));
    return gap ? [`${entry.id}: ${gap} (${entry.source})`] : [];
  });
  if (gaps.length) throw new Error(`Documentation draft gaps:\n${gaps.join("\n")}`);
}
export function renderInventory(entries: Entry[], drafts: Record<string, Draft>, approved = false) {
  let group = "";
  return entries.map((entry) => {
    const heading = group === entry.group ? "" : `\n## ${entry.group}\n\n${approved
      ? "| Key/source | Page/component rendering context | Current English source | Arabic draft — UNAPPROVED, documentation only | Approved Arabic (leave empty until approved) |\n| --- | --- | --- | --- | --- |"
      : "| ID | Key/source | Page/component rendering context | Current English source | Arabic draft — UNAPPROVED, documentation only | Category |\n| --- | --- | --- | --- | --- | --- |"}\n`;
    group = entry.group;
    const saved = drafts[entry.id];
    const draft = draftFor(entry, drafts);
    const cells = approved ? [entry.key, entry.contexts.join("; "), entry.source, draft, ""] :
      [entry.id, entry.key, entry.contexts.join("; "), entry.source, draft, saved?.category ?? entry.category];
    return heading + `| ${cells.map(escapeCell).join(" | ")} |`;
  }).join("\n") + "\n";
}
export const boundaries = `
## Boundaries and coverage

This is a live-only pending inventory, not an approval record. D-96/D-101
approval evidence is pinned independently in tests/fixtures/arabic-approval-baseline.json.
D-107 batch-2 evidence is pinned separately in tests/fixtures/arabic-batch-two-approval.json;
docs/ARABIC_APPROVAL_BATCH_TWO.md lists every applied row. Approved rows are
excluded from this pending sheet; the O-7 legal bodies remain unapproved.
No translations are applied by this command. Existing IDs survive; keyed IDs
are J-namespace-key; new unkeyed phrases use a full SHA-256 source ID (U-...).
Drafts are retained only while their exact English source matches. A source
change requires a new draft; missing drafts are visibly flagged.
Edit docs/arabic-drafts.json to retain a row-specific documentation draft;
docs/arabic-draft-proposals.json supplies documentation-only defaults for new sources.
Empty, English-only, source-identical, marker-prefixed and missing-draft
placeholders are gaps, never proposals. Generation fails before writing any
inventory if a non-legal row has such a gap (D-138). Legal bodies stay pending O-7.
Neither file is imported by the application.

Contexts identify rendered/conditionally rendered call sites, including
accessible labels, confirmation prompts, metadata, error states and feedback.
“Rendered/conditionally rendered” does not assert that every branch is visible
on initial load. Foundation samples include development-only styleguide usages.
Methodology forms/reports are live, authenticated admin/editor UI, not future-only.
Stored source metadata, criterion labels, rules, report JSON, workflow notes,
engine evidence and audit summaries are arbitrary data, not finite translation keys.
reviewText/reviewError preserve markers on arbitrary unapproved auth/audit/action
fallbacks; Zod paths/issues and EngineInputError details are unbounded.
Concrete custom validation and governance-error sources are listed; generated
Zod built-in messages are described here, not fabricated as an infinite list.
Known finite report errors are localized for display only under D-107; unknown
display errors retain review markers. Raw report JSON and engine evidence remain
unchanged. Arbitrary exception/report text remains unbounded.
Approved account/audit entries and all currently approved engine templates are absent.
No engine reason template currently carries a review marker.

Caller audit uses translator bindings, finite dynamic type unions (status/theme/
disclaimer), wrapper id/label props, governedText success/error feedback, direct
dictionary adapters, and runtime markers. LocaleDocument/getMessages supplies
the provider; passing the whole dictionary is not evidence that every leaf renders.
Whole-namespace dynamic consumers are retained and reported if unresolved.
Tests, dictionaries and documentation alone never establish a live caller.

## Founder terminology — D-103–D-111

- Edge cases = الحالات الخاصة; حدية is reserved for borderline.
- User-facing production = مُعتمد للاستخدام الفعلي / غير مُعتمد للاستخدام الفعلي.
- Admin “Enable for production” = اعتماد للاستخدام الفعلي.
- Verified by = جهة التحقق.
- Workflow approval = الموافقة / موافَق عليه; اعتماد is production-only.
- Finalized = نهائي / نهائية, not مثبّت / تُثبّت.
- Publish / unpublish = نشر / إلغاء النشر; badges = منشور / غير منشور.
- Public visibility = الإتاحة العامة.
- إصدار is reserved for methodology versions. Do not create edition copy here.

Only D-107's enumerated batch has been applied. These terminology rules do not
approve unknown future copy. Legal bodies require O-7 text, not translation.

## Integration boundary

Step 6 and locale-aware navigation restoration are merged in this checkout.
This inventory includes their actual callers, including breadcrumbs, version
sections and recovery-screen home/retry controls. D-107 approved these recorded
origins; unknown future navigation copy is not approved or invented.
`;
export function generate(check = false) {
  const audit = discover();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  const drafts = JSON.parse(readFileSync("docs/arabic-drafts.json", "utf8")) as Record<string, Draft>;
  assertDrafts(audit.entries, drafts);
  const warning = audit.unresolved.length ? `\n## Unresolved coverage — retained, needs review\n\n${audit.unresolved.map((s) => `- ${s}`).join("\n")}\n` : "";
  const header = `\nGenerated deterministically by \`pnpm ar-review:list\`. Live pending rows: **${audit.entries.length}**.\n`;
  const retainedDrafts = Object.fromEntries(audit.entries.map((entry) => [entry.id, {
    source: entry.source, draft: draftFor(entry, drafts), category: drafts[entry.id]?.category ?? entry.category,
  }]));
  const outputs = {
    "docs/arabic-draft-proposals.json": JSON.stringify(proposals, null, 2) + "\n",
    "docs/AR_REVIEW_KEYS.md": "# Live Arabic review keys\n" + header + boundaries + warning + renderInventory(audit.entries, drafts, true),
    "docs/ARABIC_REVIEW.md": "# Live Arabic review — unapproved documentation-only drafts\n" + header + boundaries + warning + renderInventory(audit.entries, drafts),
    "docs/arabic-drafts.json": JSON.stringify(retainedDrafts, null, 2) + "\n",
  };
  for (const [path, text] of Object.entries(outputs)) {
    if (check) {
      if (readFileSync(path, "utf8") !== text) throw new Error(`${path} is stale; run pnpm ar-review:list`);
    } else writeFileSync(path, text);
  }
  console.log(`${audit.entries.length} live pending rows; ${audit.unresolved.length} unresolved coverage surfaces; ${audit.unused.length} unused message leaves.`);
  return audit;
}
// Explicit maintenance operation, never part of normal regeneration. Only
// keys proven unused by the caller audit are removed; uncertain families stay.
export function pruneUnused() {
  const audit = discover();
  if (audit.errors.length || audit.unresolved.length) throw new Error(
    [...audit.errors, ...audit.unresolved].join("\n"),
  );
  const removed = new Set<string>();
  for (const locale of ["en", "ar"]) {
    const tree = readTree(locale);
    const prune = (node: Tree, prefix = ""): Tree => Object.fromEntries(
      Object.entries(node).flatMap<[string, string | Tree]>(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
          if (audit.usage.has(path)) return [[key, value]];
          removed.add(path); return [];
        }
        const child = prune(value, path);
        return Object.keys(child).length ? [[key, child]] : [];
      }),
    );
    const result = prune(tree);
    if (locale === "ar") {
      // Pruning must never revoke an existing founder-approved translation.
      result.governed = Object.fromEntries(Object.entries(audit.en)
        .filter(([key]) => key.startsWith("governed.") && audit.usage.has(key))
        .map(([key, value]) => [key.slice("governed.".length), audit.ar[key] ?? marker + value]));
    }
    writeFileSync(`src/i18n/messages/${locale}.json`, JSON.stringify(result, null, 2) + "\n");
  }
  writeFileSync("docs/arabic-dead-keys.json", JSON.stringify({
    evidence: "No Phase 0 runtime consumer found after translator-binding, finite dynamic-family, wrapper-prop, direct dictionary, provider, metadata/error/loading and runtime-marker audit. Tests/docs are not callers. No replacement immutable notice is needed: live finalizedContentReadOnly already accurately describes draft/finalized behavior.",
    removed: [...removed].sort(),
  }, null, 2) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--prune")) pruneUnused();
  else generate(process.argv.includes("--check"));
}
