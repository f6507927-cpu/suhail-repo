import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LegalDocument } from "../src/components/accounts/LegalDocument";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, currentConsent } from "../src/lib/auth/policies";

// SHA-256 of the founder-completed drafts (D-140), normalized for whitespace only.
const hashes = {
  "terms.ar": "3ad668cc22b108f5bf611eed33440dfaafbbbd5477e8a7f467939b7dc37c95d9",
  "privacy.ar": "4ddd48b027de63ce91c18eecad9691f150d475b0c9d0fdfcd17221c64cb4ea84",
  "terms.en": "8109161444e13af2165515b97d9d48e99db05a120150eccf8d836298414a6754",
  "privacy.en": "e5def5ff883c12b3588888401324d1bb08566836f62a7e70d0a7cde7569581e2",
} as const;
function digest(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}
function sourceWording(markdown: string) {
  return markdown.replace(/^---\nversion: [^\n]+\n---\n/, "")
    .replace(/⟦(?:LEGAL|AR)-REVIEW⟧/g, "")
    .split("\n").flatMap(line => {
      if (/^\| ---/.test(line)) return [];
      if (line.startsWith("|")) return line.slice(1, -1).split("|").map(cell => cell.trim());
      return line.replace(/^#{1,6} /, "").replace(/^- /, "• ");
    }).join("\n");
}
describe("supplied, unapproved bilingual legal drafts", () => {
  it("retains both real draft acceptance versions", () => {
    expect(CURRENT_TERMS_VERSION).toBe("draft-2026-10-11");
    expect(CURRENT_PRIVACY_VERSION).toBe("draft-2026-11-04");
  });
  it("requires existing accounts to re-accept the new privacy version without changing Terms",()=>{
    const accepted={terms_version:CURRENT_TERMS_VERSION,privacy_version:"draft-2026-10-11",accepted_at:new Date("2026-10-23T12:00:00Z")};
    expect(currentConsent(accepted)).toBe(false);
    expect(currentConsent({...accepted,privacy_version:CURRENT_PRIVACY_VERSION})).toBe(true);
    expect(currentConsent({...accepted,privacy_version:CURRENT_PRIVACY_VERSION,accepted_at:null})).toBe(false);
  });
  it.each(["ar","en"] as const)("keeps all three supplied stock-request bullets in the requested %s sections",locale=>{
    const file=readFileSync(`content/legal/privacy.${locale}.md`,"utf8");
    const bullets=locale==="ar"?[
      "طلبات الأسهم التي ترسلها (رمز السهم أو نص البحث)، ونحتفظ بها حتى تحذفها أو تحذف حسابك.",
      "لتسجيل الأسهم التي طلبت إضافتها، ولإحصاء الطلبات إجمالًا عند تحديد الأسهم التي نضيفها.",
      "يمكنك حذف أي طلب سهم من صفحة الحساب في أي وقت.",
    ]:[
      "stock requests you submit (the ticker or search text), kept until you remove them or delete your account.",
      "To record the stocks you asked us to add, and to count requests in total when deciding which stocks to cover.",
      "You can remove any stock request from the account page at any time.",
    ];
    for(const [index,section] of [2,3,7].entries()){
      const block=file.split(`## ${section}.`)[1].split("\n## ")[0];
      expect(block).toContain(`- ${bullets[index]}`);
    }
    expect(file).toContain(locale==="ar"?"النص العربي هو المعتمد":"the Arabic text prevails");
    const review=readFileSync("docs/ARABIC_REVIEW.md","utf8");
    if(locale==="ar")for(const bullet of bullets)expect(review).toContain(bullet);
  });
  for (const locale of ["ar", "en"] as const) for (const kind of ["terms", "privacy"] as const) {
    it(`pins exact ${kind}.${locale} founder-completed wording`, () => {
      const file = readFileSync(`content/legal/${kind}.${locale}.md`, "utf8");
      expect(file).toContain(`version: ${kind==="privacy"?CURRENT_PRIVACY_VERSION:CURRENT_TERMS_VERSION}`);
      expect(file).toContain("⟦LEGAL-REVIEW⟧");
      if (locale === "ar") expect(file).toContain("⟦AR-REVIEW⟧");
      // D-140: founder-supplied facts replace every placeholder; open legal questions live in docs/LEGAL_REVIEW_QUESTIONS.md.
      expect(file).not.toMatch(/\[(?:VERSION|DATE|CONTACT EMAIL|OPERATOR NAME|SUPABASE REGION|CONFIRM)/);
      expect(file).toContain("suhailroboadvisor@gmail.com");
      expect(file).toContain(locale === "ar" ? "القاهرة، مصر" : "Cairo, Egypt");
      if (kind === "privacy") expect(file).toContain(locale === "ar" ? "الهند (مومباي)" : "India (Mumbai)");
      expect(digest(sourceWording(file))).toBe(hashes[`${kind}.${locale}`]);
      expect(file).not.toContain("Open questions for the lawyer");
      expect(file).not.toContain("أسئلة مفتوحة للمحامي");
    });
    it(`renders ${kind}.${locale} with explicit localized draft banner and readable structure`, async () => {
      const html = renderToStaticMarkup(await LegalDocument({ kind, locale }));
      expect(html).toContain(locale === "ar" ? "مسودة — قيد المراجعة القانونية" : "Draft — under legal review");
      expect(html).not.toContain("⟦");
      expect(html.match(/<h2>/g)).toHaveLength(12);
      expect(html).toContain("<ul>");
      expect(html).not.toContain("[CONFIRM");
      expect(html).toContain(kind==="privacy"?CURRENT_PRIVACY_VERSION:CURRENT_TERMS_VERSION);
      if (kind === "privacy") {
        expect(html).toContain("<table");
        expect(html.match(/<tr>/g)).toHaveLength(4);
        for (const provider of ["Supabase", "Replit", "Google"]) expect(html).toContain(provider);
      }
    });
  }
  it("preserves lawyer questions separately under unresolved O-7", () => {
    const questions = readFileSync("docs/LEGAL_REVIEW_QUESTIONS.md", "utf8");
    const original = questions.slice(questions.indexOf("أسئلة مفتوحة للمحامي"));
    expect(digest(original)).toBe("56d62c19d44641dec6522415a4b40b8b1ab17371c6ecc0d916996bdacbc937dc");
    expect(questions).toContain("Not part of the Terms or Privacy Policy");
    expect(questions).toContain("lines 225 onward");
    expect(readFileSync("docs/DECISIONS.md", "utf8")).toMatch(/\| O-7 \| \*\*Open:/);
  });
});
