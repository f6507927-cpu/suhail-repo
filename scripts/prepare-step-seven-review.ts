/**
 * Explicit pending-copy inventory preparation, NOT an Arabic translation or approval.
 * Keep new copy visibly untranslated until a separate founder-reviewed batch.
 */
import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("docs/arabic-drafts.json", "utf8")) as Record<string, { source: string; draft: string }>;
const proposals = JSON.parse(readFileSync("docs/arabic-draft-proposals.json", "utf8")) as Record<string, string>;
let added = 0;
for (const [id, row] of Object.entries(rows)) {
  if (id.startsWith("U-") && !Object.hasOwn(proposals, row.source)) {
    proposals[row.source] = `⟦AR-REVIEW⟧ ${row.source}`;
    added++;
  }
  if (id.startsWith("U-") && row.draft.startsWith("DRAFT REQUIRED")) row.draft = proposals[row.source];
}
writeFileSync("docs/arabic-draft-proposals.json", `${JSON.stringify(proposals, null, 2)}\n`);
writeFileSync("docs/arabic-drafts.json", `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${added} untranslated documentation placeholders; no Arabic approval or runtime copy changed.`);
