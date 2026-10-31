import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { accountCopyDictionary, reviewText } from "../src/components/accounts/types";
import { auditEventType } from "../src/db/schema/accounts";
import { renderArabicDraft, type ReasonCode } from "../src/engine";
import Forbidden from "../src/app/[locale]/(private)/forbidden";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import baseline from "./fixtures/arabic-approval-baseline.json";
import batchTwo from "./fixtures/arabic-batch-two-approval.json";
import { isolateArabicCode } from "../src/i18n/bidi";
import { publicUiAmendments } from "./fixtures/public-ui-approval";

// Immutable historical evidence, independent of the regenerated pending sheet.
const rows = baseline.rows;
const edits: Record<string, string> = {
  "J-disclaimer-short": "نتائج الفحص لأغراض المعلومات فقط — وليست فتوى. تختلف المنهجيات واجتهادات العلماء. التحليل المالي ليس نصيحة استثمارية شخصية.",
  "J-banner-demo": "بيانات افتراضية / عرض تجريبي. كل الأرقام والإفصاحات والأسعار والمنهجيات في هذه الشاشة افتراضية أُعدّت لأغراض العرض فقط، ولا تصف أي مُصدِر أو سوق أو حكم حقيقي.",
  "J-banner-exampleMethodology": "مثال — غير مُتحقَّق منه — غير مُعتمد للاستخدام الفعلي. هذه المنهجية تعريف تجريبي، وليست معيارًا منشورًا، ولا تحظى بأي تأييد.",
  "J-styleguide-intro": "للتطوير فقط. هذه نماذج للمكوّنات وليست نتائج فحص. الألوان الدلالية المشتقة مقترحات لم يعتمدها المؤسس بعد.",
  "A-042": "تبقى الأبحاث العامة متاحة للجميع.",
  "F-user_mfa_reset": "إعادة تعيين تطبيق المصادقة لمستخدم",
  "F-edition_draft_created": "إنشاء مسودة عدد",
  "F-edition_published": "نشر عدد",
  "F-edition_revision": "مراجعة عدد",
  "F-edition_status_change": "تغيير حالة عدد",
};
function approvedDraft(id: string, draft: string) {
  if (id === "J-disclaimer-full") {
    return draft.replaceAll("مخصّصة لك", "شخصية").replaceAll("متاحة للجميع", "متاحة للعموم");
  }
  return edits[id] ?? draft;
}
const json = ar as Record<string, Record<string, string>>;
const english = en as Record<string, Record<string, string>>;
const deferred = (id: string) => /^J-(methodologies-|admin-|nav-screen$)/.test(id);

describe("D-101 row-level Arabic approval boundary", () => {
  it("preserves exactly the 11 approved JSON rows; surviving deferred keys remain marked", () => {
    const jsonRows = rows.filter(([id]) => id.startsWith("J-"));
    expect(jsonRows).toHaveLength(93);
    expect(jsonRows.filter(([id]) => deferred(id))).toHaveLength(82);
    for (const [id, location, , source, draft] of jsonRows) {
      const [namespace, key] = location.replaceAll("`", "").split(".");
      if (deferred(id) && english[namespace]?.[key] === undefined) {
        expect(json[namespace]?.[key], id).toBeUndefined();
        continue;
      }
      expect(english[namespace][key], id).toBe(source);
      expect(json[namespace][key], id).toBe(
        publicUiAmendments[`${namespace}.${key}`] ?? batchTwo.rows.find((row) => row.id === id && row.approved)?.applied ??
          (deferred(id) ? `⟦AR-REVIEW⟧ ${source}` : isolateArabicCode(approvedDraft(id, draft))),
      );
      if (!deferred(id)) expect(approvedArabicCopy[source], id).toBe(json[namespace][key]);
    }
  });
  it("applies all 42 account phrase approvals, preserves English and literal DELETE", () => {
    const accountRows = rows.filter(([id]) => id.startsWith("A-"));
    expect(accountRows).toHaveLength(42);
    for (const [id, , , source, draft] of accountRows) {
      expect(reviewText("ar", source), id).toBe(isolateArabicCode(approvedDraft(id, draft)));
      expect(reviewText("en", source), id).toBe(source);
    }
    for (const [source, translations] of Object.entries(accountCopyDictionary)) {
      expect(translations.ar, source).not.toContain("⟦AR-REVIEW⟧");
    }
    expect(reviewText("ar", 'Type "DELETE" to confirm')).toBe('اكتب "\u2066DELETE\u2069" للتأكيد');
  });
  it("covers all 27 audit enum codes and code-valued summaries without approving arbitrary summaries", () => {
    const codes = rows.filter(([id]) => id.startsWith("F-"));
    expect(codes.map((row) => row[3]).sort()).toEqual([...auditEventType.enumValues].sort());
    for (const [id, , , code, draft] of codes) {
      expect(reviewText("ar", code), id).toBe(approvedDraft(id, draft));
      expect(reviewText("en", code), id).toBe(code);
    }
    expect(reviewText("ar", "Unknown stored audit summary")).toBe("⟦AR-REVIEW⟧ Unknown stored audit summary");
    expect(approvedArabicCopy.Editions).toBe("الأعداد");
    expect(approvedArabicCopy["weekly edition"]).toBe("العدد الأسبوعي");
    expect(approvedArabicCopy["Default methodology version"]).toBe("إصدار المنهجية الافتراضي");
  });
  it.each(["ar", "en"])("renders the %s forbidden message using the route locale and retains 403", (locale) => {
    const providerProps = { locale, messages: {}, timeZone: "Asia/Riyadh", children: null };
    const markup = renderToStaticMarkup(createElement(
      NextIntlClientProvider,
      providerProps,
      createElement(Forbidden),
    ));
    const arabic = "يقتصر الوصول على أصحاب الأدوار المصرّح لها.";
    const english = "Access is restricted to authorized roles.";
    expect(markup).toContain(locale === "ar" ? arabic : english);
    expect(markup).not.toContain(locale === "ar" ? english : arabic);
    expect(markup).toContain("<h1>403</h1>");
    expect(markup).not.toContain("AR-REVIEW");
  });
  it("retains the fixed status labels and explicit disclaimer limitations", () => {
    expect([
      ar.status.passes_selected_methodology, ar.status.fails_selected_methodology,
      ar.status.requires_review, ar.status.insufficient_data,
    ]).toEqual(["متوافق على الأرجح", "غير متوافق على الأرجح", "يحتاج إلى مراجعة", "بيانات غير كافية"]);
    expect(ar.disclaimer.short).toContain("ليست فتوى");
    expect(ar.disclaimer.short).toContain("ليس نصيحة استثمارية شخصية");
    expect(ar.disclaimer.full).toContain("ليست فتوى");
    expect(ar.disclaimer.full).toContain("ولا تمثّل حكمًا شرعيًا خاصًا بحالة فردية");
    expect(ar.disclaimer.full).toContain("ولا يقدّم التطبيق نفسه بوصفه مرجعًا شرعيًا");
    expect(ar.disclaimer.full).toContain("متاحة للعموم");
    expect(ar.disclaimer.full).toContain("ليس نصيحة استثمارية شخصية");
    expect(ar.methodology.pageNote).toContain("ولا تمثّل تأييدًا لها أو حكمًا شرعيًا");
  });
  it("keeps supplied legal drafts unapproved with unchanged policy versions", () => {
    for (const kind of ["terms", "privacy"]) {
      const body = readFileSync(`content/legal/${kind}.ar.md`, "utf8");
      expect(body).toContain("version: draft-2026-10-11");
      expect(body).toContain("⟦LEGAL-REVIEW⟧ ⟦AR-REVIEW⟧");
      expect(body).not.toContain("[CONFIRM");
      expect(body).not.toContain("[OPERATOR NAME]");
      expect(body).not.toContain("draft awaiting founder-supplied");
    }
  });
  it("uses all 19 approved explanation substitutions, with edited staleness and primary ties", () => {
    const substitutions = baseline.substitutions;
    expect(substitutions).toHaveLength(19);
    for (const [code, draft] of substitutions) {
      const expected = code === "stale_data" ? "الفترة المالية أقدم من الحد المسموح به لعمر البيانات."
        : code === "primary_tied" ? "تساوت أكبر حصص القطاعات، فتعذّر تحديد النشاط الرئيسي."
        : code === "criterion_counts" ? "" : draft;
      expect(renderArabicDraft({
        kind: "criterion_unknown", criterionId: "fixture", label: "الدين", field: null,
        ratio: null, threshold: null, thresholdUnit: null, reasonCode: code as ReasonCode,
      })).toBe(`معيار الدين: النتيجة غير معروفة — ${expected}`);
    }
  });
});
