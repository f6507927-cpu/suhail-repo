import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import baseline from "./fixtures/brand-sha256.json";
import arabicBatchTwo from "./fixtures/arabic-batch-two-approval.json";
import { publicUiAmendments } from "./fixtures/public-ui-approval";
import {
  StatusBadge,
  type StatusCode,
} from "../src/components/foundation/StatusBadge";
import { CoverageSeal } from "../src/components/foundation/CoverageSeal";
import { Num } from "../src/components/foundation/Num";
import { LocalizedText } from "../src/components/foundation/shared";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
} from "../src/lib/format";
import { contrast, palette, semanticPairs } from "../src/lib/palette";
import { THEME_SCRIPT } from "../src/lib/theme-script";
import manifest from "../src/app/manifest";
import { runInNewContext } from "node:vm";

type Tree = { [key: string]: string | Tree };
function leaves(tree: Tree, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string"
        ? [[path, value]]
        : Object.entries(leaves(value, path));
    }),
  );
}
describe("brand preservation and real exported icons", () => {
  it("matches the fixed exact nine-file SHA-256 baseline", async () => {
    expect((await readdir("public/brand")).sort()).toEqual(
      Object.keys(baseline).sort(),
    );
    expect(Object.keys(baseline)).toHaveLength(9);
    for (const [name, hash] of Object.entries(baseline)) {
      expect(
        createHash("sha256")
          .update(await readFile(`public/brand/${name}`))
          .digest("hex"),
      ).toBe(hash);
    }
  });
  it.each([16, 32, 180, 192, 512])(
    "exports an actual %i px PNG",
    async (size) => {
      const image = await sharp(`public/icons/icon-${size}.png`).metadata();
      expect(image).toMatchObject({ width: size, height: size, format: "png" });
    },
  );
  it("has 16 and 32 pixel PNG entries in a multi-resolution ICO", async () => {
    const ico = await readFile("public/icons/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    for (const [i, size] of [16, 32].entries()) {
      const pos = 6 + i * 16;
      expect([ico[pos], ico[pos + 1]]).toEqual([size, size]);
      const length = ico.readUInt32LE(pos + 8),
        offset = ico.readUInt32LE(pos + 12);
      expect(offset + length).toBeLessThanOrEqual(ico.length);
      expect(
        await sharp(ico.subarray(offset, offset + length)).metadata(),
      ).toMatchObject({ width: size, height: size, format: "png" });
    }
  });
  it("exports reproducibly without touching the fixed baseline", async () => {
    const names = await readdir("public/icons");
    const before = await Promise.all(
      names.map((name) => readFile(`public/icons/${name}`)),
    );
    const result = spawnSync("pnpm", ["brand:icons"], {
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(result.status, result.stderr).toBe(0);
    for (const [i, name] of names.entries())
      expect(await readFile(`public/icons/${name}`)).toEqual(before[i]);
  }, 70_000);
  it("declares truthful manifest metadata", () => {
    expect(manifest()).toMatchObject({
      name: "سهيل · Suhail",
      short_name: "سهيل",
      lang: "ar",
      dir: "rtl",
      theme_color: palette.night,
      background_color: palette.night,
    });
    expect(manifest().icons).toEqual(
      [16, 32, 180, 192, 512].map((size) => ({
        src: `/icons/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
      })),
    );
  });
});
describe("dictionary extraction and explicitly unapproved Arabic", () => {
  const active = Object.keys(en);
  it("has recursive parity across the entire dictionary", () => {
    expect(Object.keys(leaves(ar)).sort()).toEqual(Object.keys(leaves(en)).sort());
  });
  it.each(active)("has recursive leaf parity for %s", (namespace) => {
    expect(Object.keys(leaves((ar as Tree)[namespace] as Tree)).sort()).toEqual(
      Object.keys(leaves((en as Tree)[namespace] as Tree)).sort(),
    );
  });
  it("preserves surviving Appendix leaves, allowing only specified changes", async () => {
    const ref = await readFile("docs/SUHAIL_BUILD_REFERENCE.md", "utf8");
    for (const [appendix, dict] of [
      ["Appendix A", en],
      ["Appendix B", ar],
    ] as const) {
      const section = ref.slice(ref.indexOf(`## ${appendix}`));
      const original = JSON.parse(
        section.match(/```json\n([\s\S]*?)\n```/)![1],
      );
      for (const [key, value] of Object.entries(leaves(original))) {
        if (["app.name", "app.tagline", "app.workingTitleNote"].includes(key))
          continue;
        // The Phase 0 caller audit removes unused prototype copy symmetrically.
        if (!(key in leaves(dict))) continue;
        expect(leaves(dict)[key]).toBe(value.replaceAll("بصغة", "بصمة"));
      }
    }
  });
  it("uses approved translations and marks all other newly missing Arabic leaves", async () => {
    const ref = await readFile("docs/SUHAIL_BUILD_REFERENCE.md", "utf8");
    const original = JSON.parse(
      ref
        .slice(ref.indexOf("## Appendix B"))
        .match(/```json\n([\s\S]*?)\n```/)![1],
    );
    const prior = leaves(original),
      english = leaves(en);
    const labels = Object.keys(en.status).filter(
      (key) =>
        key.includes("methodology") ||
        ["requires_review", "insufficient_data"].includes(key),
    );
    for (const [key, value] of Object.entries(leaves(ar))) {
      const approvedRow = arabicBatchTwo.rows.find((row) => row.approved && row.key === key);
      if (approvedRow) {
        expect(value, key).toBe(publicUiAmendments[key] ?? approvedRow.applied);
        continue;
      }
      if (
        !(key in prior) &&
        !(key.startsWith("status.") && labels.includes(key.slice(7)))
      )
        expect(value, key).toBe(
          (["controls.", "styleguide.", "disclaimer.", "banner.", "methodology.", "publicSearch."].some(
            (namespace) => key.startsWith(namespace),
          )
            ? approvedArabicCopy[english[key]!]
            : undefined) ?? `⟦AR-REVIEW⟧ ${english[key]}`,
        );
    }
  });
  it("contains no obsolete branding in src or messages", async () => {
    async function scan(path: string): Promise<void> {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isDirectory()) await scan(`${path}/${entry.name}`);
        else
          expect(
            await readFile(`${path}/${entry.name}`, "utf8"),
            `${path}/${entry.name}`,
          ).not.toMatch(/Thiqah|Shariah-Aware|base44|Base44/);
      }
    }
    await scan("src");
  });
});
describe("bilingual status and coverage", () => {
  const pairs = [
    ["passes_selected_methodology", "check", "status-pass"],
    ["fails_selected_methodology", "x", "status-fail"],
    ["requires_review", "triangle-alert", "status-review"],
    ["insufficient_data", "circle-help", "status-insufficient"],
  ] as const;
  for (const [locale, messages] of [
    ["ar", ar],
    ["en", en],
  ] as const) {
    it.each(pairs)(
      `${locale}: %s always has its label and 1.6 icon`,
      (status, icon, css) => {
        const props = {
          locale,
          messages,
          timeZone: "Asia/Riyadh",
          children: createElement(StatusBadge, { status }),
        };
        const html = renderToStaticMarkup(
          createElement(NextIntlClientProvider, props),
        );
        expect(html).toContain(messages.status[status]);
        expect(html).toContain(`lucide-${icon}`);
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain(css);
        expect(html).toContain("border-2");
      },
    );
  }
  it("requires BOTH coverage and pass; light uses the original polygon", async () => {
    for (const covered of [false, true])
      for (const [status] of pairs) {
        const html = renderToStaticMarkup(
          createElement(CoverageSeal, {
            covered,
            status: status as StatusCode,
            surface: "light",
          }),
        );
        expect(Boolean(html)).toBe(
          covered && status === "passes_selected_methodology",
        );
      }
    const html = renderToStaticMarkup(
      createElement(CoverageSeal, {
        covered: true,
        status: "passes_selected_methodology",
        surface: "light",
      }),
    );
    const original = await readFile("public/brand/mark-seal-small.svg", "utf8");
    expect(html).toContain(original.match(/points="([^"]+)"/)![1]);
    expect(html).toContain('fill="#88632C"');
    const dark = renderToStaticMarkup(
      createElement(CoverageSeal, {
        covered: true,
        status: "passes_selected_methodology",
        surface: "dark",
      }),
    );
    expect(dark).toContain("/brand/mark-seal-small.svg");
  });
  it("keeps the review marker visible and isolates English placeholder text", () => {
    const html = renderToStaticMarkup(
      createElement(LocalizedText, null, "⟦AR-REVIEW⟧ Unknown future heading"),
    );
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain("⟦AR-REVIEW⟧ ");
  });
});
describe("formatting and contrast", () => {
  it("uses Western digits and Gregorian Arabic dates", () => {
    expect(formatNumber(12345.67, "ar")).toMatch(/12.*345.*67/);
    expect(formatNumber(12345.67, "ar")).not.toMatch(/[٠-٩]/);
    expect(formatNumber(123, "ar", { numberingSystem: "arab" })).toBe("123");
    expect(formatDate("2026-10-11", "ar")).toContain("2026");
    expect(formatDate("2026-10-11", "ar")).toContain("أكتوبر");
    expect(formatDate("2026-10-11", "en")).toBe("October 11, 2026");
  });
  it("isolates a negative percentage inside RTL text", () => {
    const html = renderToStaticMarkup(
      createElement(
        "p",
        { dir: "rtl" },
        "النسبة ",
        createElement(Num, null, formatPercent(-0.125, "ar")),
      ),
    );
    expect(html).toContain('<bdi dir="ltr"');
    expect(html).toContain("12.5");
    expect(html).toContain("-");
  });
  it("requires an explicit valid money unit scale", () => {
    expect(formatMoney(12.5, "en", "USD", 1000)).toBe("$12,500.00");
    expect(() => formatMoney(12.5, "ar", "USD", 0)).toThrow(RangeError);
  });
  it("all text and meaningful border/icon pairs pass their required WCAG ratios", () => {
    for (const pair of semanticPairs) {
      if (pair.kind === "divider") continue;
      expect(
        contrast(pair.foreground, pair.background),
        pair.mapping,
      ).toBeGreaterThanOrEqual(pair.kind === "text" ? 4.5 : 3);
    }
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
  });
});
describe("static-safe early theme restoration", () => {
  it("serves exactly the tested theme source as the root's render-blocking resource", async () => {
    expect((await readFile("public/theme-restore.js", "utf8")).trim()).toBe(THEME_SCRIPT);
    const document = await readFile("src/components/foundation/LocaleDocument.tsx", "utf8");
    expect(document).toContain('src="/theme-restore.js" async blocking="render" nonce={nonce}');
    expect(document).not.toContain("dangerouslySetInnerHTML");
  });
  it.each(["light", "dark", null, "invalid"])(
    "restores only explicit choice %s",
    (choice) => {
      const operations: unknown[] = [];
      runInNewContext(THEME_SCRIPT, {
        localStorage: { getItem: () => choice },
        document: {
          documentElement: {
            classList: {
              toggle: (...args: unknown[]) => operations.push(args),
            },
          },
        },
      });
      expect(operations).toEqual(
        choice === "light" || choice === "dark"
          ? [["dark", choice === "dark"]]
          : [],
      );
    },
  );
  it("safely handles unavailable storage", () => {
    expect(() =>
      runInNewContext(THEME_SCRIPT, {
        localStorage: {
          getItem: () => {
            throw Error("unavailable");
          },
        },
      }),
    ).not.toThrow();
  });
});
