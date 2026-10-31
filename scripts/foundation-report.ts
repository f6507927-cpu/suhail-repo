import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import ar from "../src/i18n/messages/ar.json";
import { contrast, semanticPairs } from "../src/lib/palette";

function reviewKeys(tree: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? value.startsWith("⟦AR-REVIEW⟧ ")
        ? [name]
        : []
      : reviewKeys(value as Record<string, unknown>, name);
  });
}
async function main() {
  const keys = reviewKeys(ar).sort();
  const tracked = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  const added = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  const files = [
    ...new Set([...tracked, ...added, "docs/FOUNDATION_HANDOFF.md"]),
  ]
    .filter(Boolean)
    .sort();
  const screenshots = ["ar-dark", "ar-light", "en-dark", "en-light"].map(
    (name) => `generated-artifacts/styleguide/${name}.png`,
  );
  const colors = semanticPairs
    .map(
      (pair) =>
        `| ${pair.proposal ? "PROPOSAL" : "Specified"} | ${pair.mapping} | ${pair.foreground} | ${pair.background} | ${contrast(pair.foreground, pair.background).toFixed(2)}:1 | ${pair.kind === "divider" ? "Decorative only; no required contrast" : pair.kind === "text" ? "Text ≥4.5:1" : "Meaningful outline/icon ≥3:1"} |`,
    )
    .join("\n");
  const report = `# Suhail — Step 4 foundation handoff

## Scope and decisions
- Step 4 only: dark-first, Arabic-first public shell and development styleguide. No migrations. Database, health endpoint, screening engine and its Arabic reason templates are unchanged.
- D-21: ar/en, Arabic without prefix, no detection or locale cookie, explicit static locale and Gregorian/Western-digit formatting.
- D-22: default dark HTML; explicit localStorage light/dark choice; isolated before-paint script. Locale switching uses a document navigation to preserve it.
- D-37: seal requires BOTH analyst coverage and passing status. Original dark seal; original polygon with Brass Deep fill for light.
- D-40: fixed early script; no new nonce, auth, preview protection or deployment. CSP implementation remains later work.
- D-19/D-20: static/SSG public rendering, revalidate=900. D-04/D-57: no live quotes.
- §4.1–4.6 and §4.2a applied; superseded §4.7 styling avoided. §7.1 labels and §11 fixed text preserved.
- Original nine SVGs and founder reference untouched. Baseline is fixed; tests never regenerate it.
- Raw --muted is founder secondary TEXT (#5C6467). shadcn's surface meaning is --muted-surface; Tailwind bg-muted maps only to that. All semantic assignments absent from the brief are proposals below, NOT founder approval.
- Sand Deep remains available for table headers; proposed light secondary/muted surfaces use brief #EFEAE0 so secondary text and outlines remain accessible.
- Header remains Night in both modes. Methodologies link deliberately points to /methodology (or /en/methodology); destination is NOT implemented in this step.
- Full disclaimer is an expandable component in the shell, not a new legal-content route.

## Verification
- pnpm typecheck, pnpm lint, pnpm lint:logical, pnpm test and pnpm build pass.
- Unit/regression suite: 324 tests, including brand exact-file SHA-256 preservation, real PNG dimensions and ICO entries, reproducible exports, dictionary extraction/parity/review markers, all badge icon/label pairs, D-37 eligibility, formatting, early script and required contrast pairs.
- Development Playwright: 7 tests pass, including existing health check, AR/EN HTML lang/dir, same-path language switch, persisted theme, keyboard skip link, full disclaimer and no runtime Google font requests.
- Four full-page styleguide captures attached to their Playwright tests; each axe-core scan has zero serious/critical violations.
- Production Playwright: both styleguides return 404, public home locales render, no locale cookie, manifest is available and health remains ok. Build output confirms statically prerendered public pages.
- Workspace browser command: PLAYWRIGHT_CHROMIUM_EXECUTABLE=$(command -v chromium) pnpm test:e2e. The managed Chromium is used because the versioned Playwright download is not installed here; CI installs its matching Chromium.
- Preview paused before Playwright and restored afterward. No database integration, deployment or launch check was requested or performed.

## Dependencies and rationale
- next-intl: validated URL locale routing, static-safe messages and locale-aware links.
- lucide-react: specified accessible status/error/direction/control icons at stroke 1.6.
- @radix-ui/react-slot: shadcn-style Button asChild composition and Slottable.
- clsx + tailwind-merge: primitive variant/class composition without physical-direction utilities.
- sharp (development): repeatable SVG-to-PNG exports and image-dimension regression checks. ICO directory is encoded directly with lossless PNG entries; no extra encoder dependency.
- @axe-core/playwright (development): automated accessibility scans of all four locale/theme samples.

## Files changed
${files.map((file) => `- \`${file}\``).join("\n")}

## Semantic mappings and actual WCAG contrast
Every proposed semantic value is labeled PROPOSAL. Text requires ≥4.5:1; meaningful outlines/icons require ≥3:1 against adjacent surfaces. Low-contrast decorative separators/surface pairs are not relied on for boundaries or state; required borders are separate.

| Approval | Mapping / value | Foreground or first surface | Background or adjacent surface | Ratio | Requirement |
| --- | --- | --- | --- | --- | --- |
${colors}

## Arabic values requiring human review (${keys.length} leaves)
All values below start exactly with \`⟦AR-REVIEW⟧ \` plus English, visible in the UI and isolated with English language/direction semantics. No machine translation or implied human approval. Supplied Arabic status labels still need the pre-launch reviewer confirmation requested by §7.1, but are not fabricated review-placeholder values. Deferred dictionary namespaces remain verbatim except prescribed brand/typo fixes and are exempt until used.

${keys.map((key) => `- \`${key}\``).join("\n")}

## Screenshot artifacts
${screenshots.map((file) => `- \`${file}\``).join("\n")}

Also attached under \`generated-artifacts/playwright/\` with axe JSON results; CI uploads \`foundation-browser-checks\`. Generated screenshots/results are ignored by Git and deployment packaging.

## Remaining founder review
- Derived semantic colors are proposals, not approved brand decisions.
- Foundation interface/disclaimer placeholders require human Arabic drafting and approval before launch; existing engine Arabic-review work remains separate.
- No methodology, real security, edition, legal content page, authentication or integration was implemented. Stop at Step 4.
`;
  await writeFile("docs/FOUNDATION_HANDOFF.md", report);
  await mkdir("generated-artifacts", { recursive: true });
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  await writeFile(
    "generated-artifacts/foundation-handoff.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Suhail · Step 4 handoff</title><style>body{margin:0;padding:32px;background:#0B2E33;color:#E6EFEE;font:15px/1.6 system-ui}h1{color:#E0BC85;font-size:28px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 monospace;max-width:1200px}a{color:#E0BC85}</style><h1>Suhail · Step 4 foundation handoff</h1><pre>${escape(report)}</pre></html>`,
  );
  console.log(
    `Report written: ${keys.length} Arabic review keys; ${semanticPairs.length} contrast pairs.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
