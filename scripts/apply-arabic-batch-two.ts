/**
 * One-time D-107 copy generator. No database access or runtime approval switch.
 * Preserve the reviewed source/draft evidence before regenerating pending docs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isolateArabicCode } from "../src/i18n/bidi";

const fixture = "tests/fixtures/arabic-batch-two-approval.json";
if (existsSync(fixture)) throw new Error("D-107 has already been applied; its approval evidence must not be regenerated.");
type Draft = { source: string; draft: string; category: string };
type Tree = { [key: string]: string | Tree };
const drafts = JSON.parse(readFileSync("docs/arabic-drafts.json", "utf8")) as Record<string, Draft>;
const ar = JSON.parse(readFileSync("src/i18n/messages/ar.json", "utf8")) as Tree;
const en = JSON.parse(readFileSync("src/i18n/messages/en.json", "utf8")) as Tree;
const proposals = JSON.parse(readFileSync("docs/arabic-draft-proposals.json", "utf8")) as Record<string, string>;
const sheet = readFileSync("docs/ARABIC_REVIEW.md", "utf8");
const locations = new Map(sheet.split("\n").filter((line) => /^\| [JUL]-/.test(line))
  .map((line) => { const cells = line.split("|").map((cell) => cell.trim()); return [cells[1], cells[2]]; }));

const overrides: Record<string, string> = {
  "J-governed-casesFinalized": "تصبح حالات المحلّل نهائية مع هذا الإصدار وتُعرض للقراءة فقط.",
  "J-governed-finalizedContentReadOnly": "المحتوى النهائي متاح للقراءة فقط. أنشئ مسودة جديدة لتغيير محتوى المنهجية.",
  "J-governed-adminIntro": "إدارة القواعد الموثّقة وأدلة الاختبار وقرارات سير العمل والإتاحة العامة. يظل محتوى الإصدار نهائيًا بعد إتمام مرحلة المسودة.",
  "J-governed-workflowSequential": "انتقل مرحلة واحدة في كل مرة. يتحقق الخادم من توثيق المصدر والقواعد والاختبارات ومقارنة مجموعة الأوراق والمراجعة البشرية والموافقة.",
  "J-governed-publishVersion": "نشر الإصدار",
  "J-governed-unpublishVersion": "إلغاء النشر",
  "J-governed-publicVisible": "منشور",
  "J-governed-notPublic": "غير منشور",
  "J-governed-confirmPublish": "هل تريد نشر هذا الإصدار في صفحات المنهجيات العامة؟",
  "J-governed-confirmUnpublish": "هل تريد إلغاء نشر هذا الإصدار من صفحات المنهجيات العامة؟",
  "J-governed-visibilityHelp": "يغيّر هذا إتاحة هذا الإصدار فقط للزائر غير المسجّل. تظهر الإصدارات المنشورة فقط في صفحات المنهجيات العامة.",
  "J-publicMethodology-publicVersion": "إصدار منشور",
  "J-publicMethodology-publicVersions": "الإصدارات المنشورة",
  "J-methodologies-rules": "{count, plural, zero {لا توجد قواعد} one {قاعدة واحدة} two {قاعدتان} few {{displayCount} قواعد} many {{displayCount} قاعدة} other {{displayCount} قاعدة}}",
};
const sourceOverrides: Record<string, string> = {
  "Approval is required": "الموافقة مطلوبة.",
  "Publish the version before enabling production": "انشر الإصدار قبل اعتماده للاستخدام الفعلي.",
  "The editorial default methodology version cannot be unpublished; select another default first": "لا يمكن إلغاء نشر إصدار المنهجية الافتراضي للتحرير؛ اختر إصدارًا افتراضيًا آخر أولًا.",
  "A production-enabled version cannot be unpublished": "لا يمكن إلغاء نشر إصدار مُعتمد للاستخدام الفعلي.",
};
function get(tree: Tree, path: string) {
  let current: string | Tree = tree;
  for (const part of path.split(".")) {
    if (typeof current === "string") throw new Error(`Invalid message path: ${path}`);
    current = current[part];
  }
  return current;
}
function set(tree: Tree, path: string, value: string) {
  const parts = path.split(".");
  let current = tree;
  for (const part of parts.slice(0, -1)) current = current[part] as Tree;
  current[parts.at(-1)!] = value;
}
function terminology(text: string) {
  return text.replaceAll("المثبّتة", "النهائية").replaceAll("المثبّت", "النهائي")
    .replaceAll("مثبّتًا", "نهائيًا").replaceAll("مثبّتة", "نهائية");
}
const phrases: Record<string, string> = {
  approved: "موافَق عليه",
  Approved: "موافَق عليه",
  Approval: "الموافقة",
};
const rows = Object.entries(drafts).map(([id, row]) => {
  const key = locations.get(id);
  if (!key) throw new Error(`Reviewed row missing from sheet: ${id}`);
  if (id.startsWith("L-")) return { id, key, ...row, approved: false, applied: null };
  const applied = isolateArabicCode(terminology(overrides[id] ?? sourceOverrides[row.source] ?? row.draft));
  if (id.startsWith("J-")) {
    if (get(en, key) !== row.source) throw new Error(`English source changed since review: ${id}`);
    set(ar, key, applied);
  } else {
    if (phrases[row.source] && phrases[row.source] !== applied) throw new Error(`Conflicting approved phrase: ${row.source}`);
    phrases[row.source] = applied;
  }
  proposals[row.source] = applied;
  return { id, key, ...row, approved: true, applied };
});
// Protect the exact reviewed batch from accidentally absorbing later pending copy.
if (rows.length !== 277 || rows.filter((row) => row.approved).length !== 275) {
  throw new Error("The reviewed batch has changed; do not broaden founder approval.");
}
function isolateTree(tree: Tree) {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") tree[key] = isolateArabicCode(value);
    else isolateTree(value);
  }
}
isolateTree(ar);
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
writeFileSync(fixture, json({ decision: "D-107", terminology: ["D-108", "D-109", "D-110", "D-111"],
  rulesCountArguments: ["count", "displayCount"], rows }));
writeFileSync("src/i18n/messages/ar.json", json(ar));
writeFileSync("src/i18n/approved-arabic-batch-two.json", json(phrases));
writeFileSync("docs/arabic-draft-proposals.json", json(proposals));
const escape = (text: string) => text.replaceAll("|", "&#124;").replaceAll("\n", "<br>")
  .replaceAll("\u2066", "⟨LRI⟩").replaceAll("\u2069", "⟨PDI⟩");
const appliedRows = rows.filter((row) => row.approved);
writeFileSync("docs/ARABIC_APPROVAL_BATCH_TWO.md", [
  "# Founder Arabic approval — batch 2 (D-107)",
  "",
  "275 current review rows approved and applied. The two legal bodies remain pending O-7.",
  "The four replacements are the four phrases in the immediately preceding review table.",
  "D-108–D-111 terminology overrides the original drafts. No edition copy was created.",
  "The original D-101 evidence is unchanged; this batch is pinned independently in tests/fixtures/arabic-batch-two-approval.json.",
  "⟨LRI⟩ / ⟨PDI⟩ below denote invisible LTR isolation, not displayed characters.",
  "Arabic rule counts use ICU categories and a Western-digit displayCount argument; English remains unchanged.",
  "",
  "| Row ID | English source | Reviewed draft | Applied Arabic | Change from draft |",
  "| --- | --- | --- | --- | --- |",
  ...appliedRows.map((row) => `| ${[row.id, row.source, row.draft, row.applied!, row.draft === row.applied ? "None — exactly as drafted" : "Terminology, plural or bidi amendment (D-107–D-111)"].map(escape).join(" | ")} |`),
  "",
  "## Explicit terminology labels",
  "",
  "| Source | Applied Arabic |",
  "| --- | --- |",
  "| approved / Approved | موافَق عليه |",
  "| Approval | الموافقة |",
  "",
  "## Still pending — not applied",
  "",
  "- L-privacy-body — founder-supplied O-7 legal text required.",
  "- L-terms-body — founder-supplied O-7 legal text required.",
  "",
].join("\n"));
console.log("D-107: applied 275 rows; retained both O-7 legal holds; English untouched.");
