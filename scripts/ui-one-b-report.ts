import { mkdirSync, writeFileSync } from "node:fs";
import { uiOneBArabic } from "../src/i18n/approved-arabic-ui-one-b";
import { uiOneBReviewProposals } from "../src/i18n/ui-one-b-review-proposals";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { isolateArabicCode } from "../src/i18n/bidi";

const extra = Object.entries(uiOneBReviewProposals);
const prior = Object.entries(uiOneBArabic).filter(([source, text]) =>
  approvedArabicCopy[source] !== isolateArabicCode(text));
const testInventory = [
  ["tests/arabic-approval.test.ts", "Only the authorized unknown-audit-summary fallback assertion changes to unmarked English, with new no-annotation/no-Arabic assertions. Every audit-code and baseline comparison is unchanged."],
  ["tests/arabic-batch-two.test.ts", "Only unknown/prototype-name marker fallback expectations change to the exact English source; all independent approval and legal assertions stay."],
  ["src/components/accounts/copy.test.ts", "Only unapproved dictionary/generic fallback marker expectations change to unmarked English; approved copy and DELETE assertions stay."],
  ["tests/mfa-copy.test.ts", "Only the unknown enrollment-error fallback expectation changes; all exact approved authenticator messages stay."],
  ["tests/public-ui-labels.test.tsx", "Only the unknown phrase marker assertion changes; complete known-label families and approved unknown-label wording stay."],
  ["tests/arabic-follow-up.test.tsx", "Unlisted phrase expects unmarked English. Manual close saved now uses the explicitly swept UI-1B proposal, not a blanket draft lookup. All independently pinned translations, categories, markup and numeric counts stay."],
  ["tests/foundation.test.ts", "Missing-leaf fallback uses the Arabic copy map, including the newly filled closing-on key, or unmarked source. The legacy-marker display test now requires stripped English with unchanged lang/dir isolation."],
  ["tests/public-ux-copy.test.tsx", "Public and private unknown fallbacks are unmarked; search hints/empty-body values use the supplied Arabic. Existing approved search wording and record assertions stay."],
  ["tests/unmet-search.test.tsx", "The admin panel has its supplied Arabic heading and no annotation; all query normalization, SQL/privacy/count and permission assertions stay."],
  ["tests/stock-ux-five.test.tsx", "Only the language-notice count becomes zero after the remaining empty-record interface prose is translated. Every initially closed server-rendered full-record, immutable hash, source, identity, disclaimer and input-preservation assertion stays."],
  ["tests/ar-review.test.ts", "Caller discovery is checked through the complete phrase-context map even after localization; the retired empty-search key has its newly approved Arabic. Independent historical/JSON/legal checks stay."],
  ["tests/ui-one-b-copy.test.tsx (new)", "Independent exact 107-row attachment pin, older-approval precedence, complete finite helper/metadata/JSX caller corpus, account registry, all Arabic JSON leaves, developer palette descriptors, unknown English fallback isolation and requested helper source guards."],
  ["e2e/ui-one-b.spec.ts + playwright.ui-one-b.config.ts (new)", "18 actual development-page visits: all nine requested routes in Arabic and English, including closed DOM text, accessible labels, titles and legal article marker absence; no sign-in or privileged writes."],
];
const sections = [
  "# UI-1B — label-only implementation and founder review",
  "Decision **D-162**, 5 November 2026. The supplied 107 pairs are approved. The additional pairs below are requested runtime proposals for founder review, not individually pre-approved legal or methodology wording. Older approved Arabic wins. O-7 remains open.",
  "## Earlier approvals retained",
  "| English | Retained Arabic | Supplied alternative not applied |\n| --- | --- | --- |\n" +
    prior.map(([s, v]) => `| ${s} | ${approvedArabicCopy[s]} | ${v} |`).join("\n"),
  `## Additional sweep proposals (${extra.length})\n\nEach added source and its Arabic is listed here, including developer-page labels. Technical identifiers, version codes, hashes, currency codes, CSS identifiers, URLs and source/company identities are not translated.`,
  "| English source | Arabic proposal |\n| --- | --- |\n" + extra.map(([s, t]) => `| ${s} | ${t} |`).join("\n"),
  "## Modified/new test inventory\n\n| Test | Exact reason / preserved boundaries |\n| --- | --- |\n" + testInventory.map(([f, t]) => `| ${f} | ${t} |`).join("\n"),
  "## Changed source and documentation groups",
  "- i18n: new exact approval file and separate review-proposal file; Arabic closing-on/search keys; approved-copy precedence; unmarked reviewText/accountCopyDictionary/structured-label fallback; bidi token isolation; legacy annotation cleanup helper.",
  "- Shared theme/locale/text rendering: content/approval-aware English fallback isolation instead of marker-based detection. Existing approved markup, including CIK and English approved copy, remains unchanged.",
  "- Account, sign-in/MFA/admin: shared fallback behavior; alert/status and arbitrary audit-summary boundaries explicitly isolate unmapped English; methodology-record aria-label localized.",
  "- Financial/stock/developer consumers: financial header/calculation labels, SEC SIC label and developer interface/palette descriptors localized on copies. No underlying evidence or palette/contrast values change.",
  "- Audit: inventories all finite helper and JSX-copy callers plus private metadata, even when already translated, while retaining the separate legal review gate. Generated review docs/draft index refreshed.",
  "## Verification and limitations",
  "See docs/UI_ONE_B_VALIDATION.md for actual command results and page checks. Signed-in account/MFA/admin screens require real sessions and were not browser-verified; finite source/registry and unit checks cover their labels without auth bypass. Arbitrary stored narratives, external provider text and future errors remain unmodified English when unmapped; they are not claimed as an infinite translation catalogue.",
  "Legal files are untouched. Their line-4 launch-gate markers remain in source; the existing LegalDocument presentation strips them before rendering. Both legal routes in both locales are checked in Playwright. No engine/reason template, historical approval fixture, stored record/hash, status, source, threshold, methodology record, policy, migration or deployment change.",
];
const markdown = sections.join("\n\n") + "\n";
writeFileSync("docs/UI_ONE_B_REVIEW.md", markdown);
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const rows = extra.map(([s, t]) => `<tr><td lang="en" dir="ltr">${escape(s)}</td><td lang="ar" dir="rtl">${escape(t)}</td></tr>`).join("");
mkdirSync("generated-artifacts/ui-one-b", { recursive: true });
writeFileSync("generated-artifacts/ui-one-b/review.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UI-1B label review</title><style>body{font:16px/1.65 system-ui;margin:30px auto;padding:0 20px;max-width:1100px;color:#142c30}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd2d2;padding:10px;text-align:start;vertical-align:top}td[lang=ar]{font-size:18px}pre{white-space:pre-wrap;font:14px/1.6 system-ui}</style><h1>UI-1B — additional labels for review</h1><p>D-162 · 5 November 2026. ${extra.length} additional Arabic proposals. The supplied 107-row table is separate and approved. Earlier translations win; no legal approval.</p><table><tr><th>English source</th><th>Arabic proposal</th></tr>${rows}</table><h2>Test inventory and boundaries</h2><pre>${escape(sections.slice(5).join("\n\n"))}</pre></html>`);
console.log(`${extra.length} review proposals; ${prior.length} older approvals retained.`);
