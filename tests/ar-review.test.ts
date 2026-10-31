import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { assertDrafts, discover, draftFor, draftGap, escapeCell, generate, leaves, marker, phraseId, renderInventory, type Entry } from "../scripts/ar-review";
import en from "../src/i18n/messages/en.json";
import ar from "../src/i18n/messages/ar.json";
import removed from "../docs/arabic-dead-keys.json";
import drafts from "../docs/arabic-drafts.json";
import batchTwo from "./fixtures/arabic-batch-two-approval.json";

let audit: ReturnType<typeof discover>;
beforeAll(() => { audit = discover(); }, 60_000);

describe("live-only pending Arabic inventory with pinned founder approvals", () => {
  it("has recursive parity and no proven-unused message leaves", () => {
    expect(Object.keys(leaves(ar)).sort()).toEqual(Object.keys(leaves(en)).sort());
    expect(audit.errors).toEqual([]);
    expect(audit.unresolved).toEqual([]);
    expect(audit.unused).toEqual([]);
    expect(removed.removed.length).toBeGreaterThan(8);
    for (const key of removed.removed) {
      expect(leaves(en)[key], key).toBeUndefined();
      expect(leaves(ar)[key], key).toBeUndefined();
    }
    for (const key of ["admin.productionBlocked", "admin.productionBlockedShort",
      "admin.immutableNotice", "admin.demoData", "admin.reloadDemo",
      "admin.reloadingDemo", "admin.demoNote", "nav.screen"]) {
      expect(removed.removed).toContain(key);
    }
  });
  it("retains finite dynamic families and explicit current rendering contexts", () => {
    for (const key of ["status.passes_selected_methodology", "status.fails_selected_methodology",
      "status.requires_review", "status.insufficient_data", "controls.light", "controls.dark",
      "disclaimer.short", "disclaimer.full", "governed.save", "governed.saving",
      "governed.prohibitedCategories", "governed.nonPermissibleCategories"]) {
      expect(audit.usage.has(key), key).toBe(true);
    }
    for (const key of ["governed.invalidJsonObject", "governed.confirmProduction",
      "governed.metadataSaved", "governed.saved", "publicMethodology.versionSelector"]) {
      expect(audit.usage.get(key)?.size, key).toBeGreaterThan(0);
      expect([...audit.usage.get(key)!].join()).toMatch(/Rendered|rendered/);
    }
    for (const source of ["All tests and mandatory analyst criterion coverage must pass", "role_required", "operation_failed"]) {
      expect(batchTwo.rows.some((entry) => entry.source === source && entry.approved)).toBe(true);
      expect(audit.entries.some((entry) => entry.source === source)).toBe(false);
    }
    for (const source of ["Edit segment", "New segment", "Filing confirmation", "New fact override"]) {
      expect(audit.entries.find(entry => entry.source === source)?.contexts.join()).toContain("FinancialAdmin.tsx");
    }
  });
  it("has stable surviving IDs, no approved/dead rows, and supplied legal drafts under original IDs", () => {
    const ids = audit.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    // New Step-7 copy is unapproved; D-107's enumerated origins stay approved.
    expect(ids).toEqual(expect.arrayContaining(["L-privacy-body", "L-terms-body"]));
    expect(ids).toContain("L-terms-body");
    expect(ids).toContain("L-privacy-body");
    expect(ids.some((id) => /^[AFEI]-/.test(id))).toBe(false);
    expect(ids).not.toContain("J-nav-screen");
    expect(ids).not.toContain("J-disclaimer-short");
    expect(ids).not.toContain("J-admin-immutableNotice");
    for (const entry of audit.entries) {
      if (entry.id.startsWith("L-")) {
        expect(draftFor(entry, drafts)).toBe(entry.source);
        expect(entry.source).not.toContain("[CONFIRM");
        expect(entry.source).toMatch(/[\u0600-\u06ff]/);
      }
      else {
        const draft = draftFor(entry, drafts);
        expect(draftGap(entry, draft), entry.id).toBeNull();
        expect(draft, entry.id).toMatch(/[\u0600-\u06ff]/);
      }
    }
  });
  it("preserves the D-107 approval for merged navigation and recovery wording", () => {
    const expected = {
      "Version sections": "أقسام الإصدار",
      "Breadcrumb": "مسار الصفحة",
      "Back to Suhail": "العودة إلى سهيل",
      "Retry": "إعادة المحاولة",
      "This page could not be loaded.": "تعذّر تحميل هذه الصفحة.",
    };
    for (const [source, draft] of Object.entries(expected)) {
      const entry = batchTwo.rows.find((row) => row.source === source && row.approved);
      expect(entry, source).toBeDefined();
      expect(entry?.applied).toBe(draft);
    }
    const sheet = readFileSync("docs/ARABIC_REVIEW.md", "utf8");
    expect(sheet).toContain("Step 6 and locale-aware navigation restoration are merged");
    expect(sheet).not.toContain("inventory is BLOCKED");
  });
  it("applies the founder's terminology only at the enumerated approved origins", () => {
    const expected = {
      "Edge cases": "الحالات الخاصة", "Verified by": "جهة التحقق",
      "Available in production": "مُعتمد للاستخدام الفعلي",
      "Not enabled for production": "غير مُعتمد للاستخدام الفعلي",
      "Enable production": "اعتماد للاستخدام الفعلي",
    };
    for (const [source, draft] of Object.entries(expected)) {
      const entries = batchTwo.rows.filter((entry) => entry.source === source && entry.approved);
      expect(entries.length, source).toBeGreaterThan(0);
      entries.forEach((entry) => {
        expect(entry.applied).toBe(draft);
        expect(audit.ar[entry.key]).toBe(draft);
      });
    }
  });
  it("preserves retained drafts and interpolation, escapes tables, and leaves approval cells empty", () => {
    const entry: Entry = { id: "J-fixture-copy", key: "fixture.copy", source: "Value {count} | <x>",
      contexts: ["Rendered: fixture"], group: "Fixture", category: "help/error" };
    const saved = { [entry.id]: { source: entry.source, draft: "قيمة {count} | <x>" } };
    const sheet = renderInventory([entry], saved);
    expect(sheet).toContain("قيمة {count} &#124; &lt;x&gt;");
    expect(escapeCell("A&B\nC")).toBe("A&amp;B<br>C");
    expect(renderInventory([entry], saved, true).split("\n").find((line) => line.startsWith("| fixture.copy")))
      .toBe("| fixture.copy | Rendered: fixture | Value {count} &#124; &lt;x&gt; | قيمة {count} &#124; &lt;x&gt; |  |");
    expect(draftFor({ ...entry, source: "Changed {count}" }, saved)).toMatch(/DRAFT REQUIRED/);
    expect(phraseId("Original")).toBe(phraseId("Original"));
    expect(phraseId("Original")).not.toBe(phraseId("Another"));
  });
  it("rejects missing, English-only, marked and sentinel drafts before publication", () => {
    const entry: Entry = { id: phraseId("Unlisted English {value}"), key: "runtime phrase",
      source: "Unlisted English {value}", contexts: ["Rendered: fixture"], group: "Fixture", category: "UI label" };
    for (const draft of [undefined, "", "  ", entry.source, "Other English", marker + entry.source,
      "DRAFT REQUIRED — not approved", "⟦AR-REVIEW⟧ نص غير معتمد"]) {
      expect(draftGap(entry, draft)).not.toBeNull();
      expect(() => assertDrafts([entry], { [entry.id]: { source: entry.source, draft: draft ?? "" } })).toThrow(/draft gaps/);
    }
    expect(() => assertDrafts([entry], { [entry.id]: { source: entry.source, draft: "نص تجريبي {value}" } })).not.toThrow();
    expect(draftFor({ ...entry, source: "Changed English" }, { [entry.id]: { source: entry.source, draft: "نص تجريبي {value}" } })).toContain("DRAFT REQUIRED");
    expect(() => assertDrafts([{ ...entry, id: "L-privacy-body" }], {})).not.toThrow();
  });
  it("regenerates byte-identical documents from unchanged sources", () => {
    expect(() => generate(true)).not.toThrow();
    const sheet = readFileSync("docs/ARABIC_REVIEW.md", "utf8");
    expect(sheet).not.toContain("Not yet rendered");
    expect(sheet).not.toContain("Historical Phase 1");
    expect(sheet).toContain("Step 6 and locale-aware navigation restoration are merged");
    const inventory = readFileSync("docs/AR_REVIEW_KEYS.md", "utf8");
    for (const line of inventory.split("\n").filter((line) =>
      line.startsWith("| ") && !line.startsWith("| Key/") && !line.startsWith("| ---"))) {
      expect(line.endsWith(" |  |"), line).toBe(true);
    }
  }, 60_000);
  it("discovers new sources independently of draft mappings, preserves uncertain consumers, and reports missing English", () => {
    const english = { ...leaves(en), "fixture.live": "New {value}", "fixture.whole": "Whole family",
      "fixture.removed": "Unused", "fixture.approved": "Approved" };
    const arabic = { ...leaves(ar), "fixture.live": marker + "New {value}",
      "fixture.whole": marker + "Whole family", "fixture.removed": marker + "Unused",
      "fixture.approved": "موافق عليه في الاختبار فقط" };
    const changed = discover({ english, arabic, extraSources: {
      "src/components/ar-review-synthetic.tsx": `
        import {useTranslations} from "next-intl";
        import dictionary from "../i18n/messages/en.json";
        export function Fixture() {
          const t = useTranslations("fixture");
          const namespace = dictionary.publicMethodology;
          return <p>{t("live")}{t("approved")}{t("missingEnglish")}{namespace.workflowStatus}</p>;
        }`,
    } });
    expect(changed.entries.find((entry) => entry.key === "fixture.live")?.source).toBe("New {value}");
    expect(changed.entries.some((entry) => entry.key === "fixture.removed")).toBe(false);
    expect(changed.entries.some((entry) => entry.key === "fixture.approved")).toBe(false);
    expect(changed.errors.join()).toContain("Missing English counterpart: fixture.missingEnglish");
    expect(changed.unresolved.join()).toContain("Whole dictionary/namespace consumer");
    expect(changed.usage.has("publicMethodology.workflowStatus")).toBe(true);
  }, 60_000);
});
