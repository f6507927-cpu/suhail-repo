/** Offline, reproducible excerpts; raw HTML remains temporary and ignored. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const patterns: Record<string, RegExp> = {
  AAPL: /Other income.*?expense/gi, MSFT: /Interest and dividends income/gi,
  AVGO: /Interest income\s*\$|Net income\s*\$/gi, CSCO: /Interest income\s*\$/gi,
  QCOM: /Interest and dividend income\s*\$/gi, NFLX: /Includes interest income of/gi,
  COST: /Interest income and other, net/gi, HD: /Interest income/gi,
  AMD: /Interest income\s*\$/gi, TXN: /ncludes interest, royalty/gi,
  PEP: /Interest income|Interest expense/gi, LLY: /Other.net.*?income|Other.net.*?expense/gi,
  ORCL: /Total notes payable and other borrowings|Commercial paper notes\s/gi,
  JNJ: /The current portion of the long-term debt was|Loans and notes payable/gi,
  XOM: /Net income.*?noncontrolling|Total revenues and other income/gi,
};
const evidence = Object.fromEntries(Object.entries(patterns).map(([ticker, pattern]) => {
  const raw = readFileSync(`generated-artifacts/sec-launch/${ticker}-filing.html`, "utf8");
  const metadata = JSON.parse(readFileSync(`generated-artifacts/sec-launch/${ticker}-filing-metadata.json`, "utf8"));
  if (createHash("sha256").update(raw).digest("hex") !== metadata.sha256) throw new Error("Filing hash mismatch");
  const text = raw.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const matches = [...text.matchAll(pattern)];
  const excerpts = matches.slice(-3).map(m => text.slice(Math.max(0, m.index! - 180), m.index! + 1000));
  return [ticker, { ...metadata, extraction: "HTML tags removed, whitespace collapsed, numeric space/amp entities decoded; excerpt offsets in resulting text",
    excerpts, matched: excerpts.length > 0 }];
}));
writeFileSync("tests/fixtures/sec/launch/filing-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
