import { candidates, durationItems, SEC_CALCULATION_VERSION, sumItems, prohibitedIncomeWarning } from "./mapping";
import { allAnnual, annual, day, entries, latest, selectAnnual, type Entry } from "./selection";
import type { CompanyFacts, FilingSource, MappedFact, Retrieval } from "./types";

/** Pure mapping: callers provide retrieval provenance; no DB, clock or network. */
export function mapAnnual(data: CompanyFacts, retrieval: Retrieval) {
  const selected = selectAnnual(data);
  const annualRows = allAnnual(data);
  const durationRows = Object.keys(data.facts["us-gaap"] ?? {}).flatMap(tag => entries(data, tag))
    .filter(e => e.start !== undefined);
  function source(e: Entry): FilingSource {
    const filingRows = durationRows.filter(row => row.accn === e.accn).sort((a, b) => b.end.localeCompare(a.end) || latest(a, b));
    const ownPeriod = filingRows[0];
    const year = ownPeriod?.fy ?? e.fy;
    const title = `${e.form} ${year ?? e.end.slice(0, 4)}`;
    return {
      label: `SEC EDGAR ${title} ${e.accn}`, source_type: "regulatory_filing",
      provider: "SEC EDGAR", document_title: title, document_reference: e.accn,
      source_url: `https://www.sec.gov/Archives/edgar/data/${data.cik}/${e.accn.replaceAll("-", "")}/${e.accn}-index.html`,
      retrieved_at: retrieval.retrieved_at, reporting_period: ownPeriod?.end ?? e.end,
      confidence_tier: "Verified", is_synthetic: retrieval.is_synthetic,
      is_demo: retrieval.is_demo, production_blocked: retrieval.is_synthetic || retrieval.is_demo,
      filed: e.filed,
    };
  }
  function base(line: string, end = selected.end): MappedFact {
    return { line_item: line, value: null, currency: line === "shares_outstanding" ? null : "USD",
      unit: line === "shares_outstanding" ? "shares" : "USD", unit_scale: "absolute",
      input_state: "unknown", confidence_tier: "Estimated", as_of_date: end,
      mapping_note: "", unknown_note: null, source: null, calculation_version: SEC_CALCULATION_VERSION };
  }
  function unknown(fact: MappedFact, tags: readonly string[], reason?: string): MappedFact {
    fact.unknown_note = reason ?? `No XBRL value among: ${tags.join(", ")}`;
    fact.mapping_note = fact.mapping_note ? `${fact.mapping_note}; ${fact.unknown_note}` : fact.unknown_note;
    return fact;
  }
  function usable(e: Entry, start: string, end: string, duration: boolean) {
    return e.unit === "USD" && e.end === end &&
      (duration ? annual(e) && e.start === start : e.start === undefined);
  }
  function direct(line: string, tags: readonly string[], start = selected.start, end = selected.end, comparative = false): MappedFact {
    const fact = base(line, end);
    for (const tag of tags) {
      // D-05: take the latest actual annual filing of this exact observation.
      // A sparse amendment does not erase an unchanged direct value from its
      // original 10-K. Component sums, unlike direct facts, stay filing-local.
      const rows = entries(data, tag).filter(e =>
        (e.form === "10-K" || e.form === "10-K/A") && e.fp === "FY");
      const matching = rows.filter(e => usable(e, start, end, comparative || durationItems.has(line))).sort(latest);
      const e = matching[0];
      if (!e) continue;
      if (line === "prohibited_income" && e.val < 0)
        return unknown(fact, tags, "Interest-income candidate is negative; gross annual prohibited income unavailable");
      const estimated = line === "prohibited_income" || line === "interest_bearing_investments" ||
        (line === "cash_and_equivalents" && tag !== candidates.cash_and_equivalents[0]);
      return { ...fact, value: e.val, input_state: estimated ? "estimated" : "reported",
        confidence_tier: estimated ? "Estimated" : "Verified", source: source(e),
        mapping_note: `${tag} = ${e.val} USD; ${e.start ? `${e.start} to ` : "instant "}${e.end}` +
          (line === "interest_bearing_investments" ? "; interest-bearing status unproven until analyst confirms filing notes (D-06)" : "") +
          (line === "prohibited_income" ? prohibitedIncomeWarning(tag) : "") +
          (tag === "ProfitLoss" ? "; consolidated net income including noncontrolling interests, not parent-attributable net income" : "") +
          (estimated && line === "cash_and_equivalents" ? "; broader balance includes restricted cash; estimated cash proxy" : "") };
    }
    const present = tags.flatMap(tag => entries(data, tag).filter(e =>
      (e.form === "10-K" || e.form === "10-K/A") && e.fp === "FY"));
    return unknown(fact, tags, present.length && !comparative ?
      `No compatible USD ${durationItems.has(line) ? "annual duration" : "period-end instant"} for ${end} among: ${tags.join(", ")}` : undefined);
  }
  function sum(line: string, tags: readonly string[]): MappedFact {
    const fact = base(line);
    const selectedRows = (tag: string) => entries(data, tag).filter(e => e.accn === selected.accn);
    const total = line === "interest_bearing_debt" ? "LongTermDebt" : tags[0];
    const excluded: string[] = selectedRows(total).length ?
      (line === "interest_bearing_debt" ? ["LongTermDebtNoncurrent", "LongTermDebtCurrent"] : tags.slice(1)) : [];
    if (line === "interest_bearing_debt") {
      // Carrying-value alternatives; never add notes on top of the debt they
      // represent. Presence (even unusable presence) blocks a lower alternative.
      if (selectedRows("LongTermDebt").length || selectedRows("LongTermDebtNoncurrent").length)
        excluded.push("LongTermNotesPayable");
      if (selectedRows("LongTermDebt").length || selectedRows("LongTermDebtCurrent").length)
        excluded.push("NotesPayableCurrent");
      if (selectedRows("ShortTermBorrowings").length) excluded.push("CommercialPaper");
      // Filing-specific scope verified against the actual note tables. Do not
      // infer these extra overlaps from names, magnitudes, or future filings.
      if (data.cik === 1341439 && selected.accn === "0001193125-26-277521")
        excluded.push("ShortTermBorrowings", "CommercialPaper"); // ORCL note 6 includes both.
      if (data.cik === 200406 && selected.accn === "0000200406-26-000016") {
        const index = excluded.indexOf("LongTermDebtNoncurrent");
        if (index >= 0) excluded.splice(index, 1);
        excluded.push("LongTermDebt", "LongTermDebtCurrent", "NotesPayableCurrent");
      }
      // JNJ note 7: short-term balance includes current long-term maturities.
    }
    const active = tags.filter(tag => !excluded.includes(tag));
    const absent: string[] = [];
    const used: Entry[] = [];
    const invalid: string[] = [];
    for (const tag of active) {
      const rows = selectedRows(tag);
      if (!rows.length) { absent.push(tag); continue; }
      const matches = rows.filter(e => usable(e, selected.start, selected.end, false)).sort(latest);
      const e = matches[0];
      if (e) used.push(e);
      else invalid.push(`${tag}: incompatible unit/period (${rows.map(r => `${r.val} ${r.unit}, ${r.start ?? "instant"} to ${r.end}`).join("; ")})`);
    }
    fact.mapping_note = `Used: ${used.map(e => `${e.tag} = ${e.val} USD`).join(", ") || "none"}; ` +
      `Absent in selected filing: ${absent.join(", ") || "none"}; ` +
      `Alternative excluded: ${[...new Set(excluded)].join(", ") || "none"}` +
      (line === "interest_bearing_debt" && data.cik === 1341439 && selected.accn === "0001193125-26-277521" ?
        "; ORCL note 6: current/noncurrent notes include commercial paper and other borrowings; filing-specific scope" : "") +
      (line === "interest_bearing_debt" && data.cik === 200406 && selected.accn === "0000200406-26-000016" ?
        "; JNJ note 7: ShortTermBorrowings includes current long-term maturities; use noncurrent debt plus that current balance; filing-specific scope" : "") +
      (line === "interest_bearing_debt" ? "; finance and operating lease liabilities excluded (D-44)" : "");
    fact.source = used.length ? source(used[0]) : source(selected);
    if (invalid.length) return unknown(fact, tags, `Unusable present component: ${invalid.join("; ")}`);
    if (!used.length) return unknown(fact, tags);
    const incompleteDebt = line === "interest_bearing_debt" &&
      !used.some(e => e.tag === "LongTermDebt" || e.tag === "LongTermDebtNoncurrent");
    if (incompleteDebt) fact.mapping_note += "; No long-term debt tag found; total may be incomplete — analyst to confirm";
    const directTotal = line !== "interest_bearing_debt" && used.some(e => e.tag === total);
    return { ...fact, value: used.reduce((total, e) => total + e.val, 0),
      input_state: incompleteDebt ? "estimated" : directTotal ? "reported" : "derived",
      confidence_tier: incompleteDebt ? "Estimated" : directTotal ? "Verified" : "Calculated" };
  }
  const facts = Object.entries(candidates).filter(([line]) => line !== "shares_outstanding")
    .map(([line, tags]) => sumItems.has(line) ? sum(line, tags) : direct(line, tags));
  // Latest cover-page shares may come from a later 10-Q, never miscite the 10-K.
  const shareTag = candidates.shares_outstanding[0];
  const share = entries(data, shareTag).filter(e => e.unit === "shares" && !e.start &&
    ["10-K", "10-K/A", "10-Q", "10-Q/A"].includes(e.form))
    .sort((a, b) => b.end.localeCompare(a.end) || latest(a, b))[0];
  const cover = share ? entries(data, shareTag).filter(e => e.accn === share.accn && e.end === share.end && e.unit === "shares" && !e.start) : [];
  const classes = new Set(cover.flatMap(e => e.member ? [e.member] : e.share_class ? [e.share_class] :
    Object.entries(e.dimensions ?? {}).filter(([axis]) => /class.*stock|stock.*class|classof|shareclass/i.test(axis)).map(([, member]) => member)));
  const classConcern = classes.size > 1 || cover.some(e => e.explicitly_aggregated === true);
  facts.push(share ? { ...base("shares_outstanding", share.end), value: share.val,
    input_state: "reported", confidence_tier: "Verified", source: source(share),
    ...(classConcern ? { shares_class_concern: true } : {}),
    mapping_note: `${shareTag} = ${share.val} shares; cover-page as-of ${share.end}` +
      (classConcern ? "; explicit multiple class/member or aggregated cover-page evidence: " + JSON.stringify(cover) : "") } :
    unknown(base("shares_outstanding"), candidates.shares_outstanding));
  const priorEnd = new Date((day(selected.start) - 1) * 86_400_000).toISOString().slice(0, 10);
  const prior = annualRows.filter(e => e.unit === "USD" && e.end === priorEnd).sort(latest)[0];
  for (const [line, tags] of [["prior_year_revenue", candidates.total_revenue], ["prior_year_net_income", candidates.net_income]] as const) {
    facts.push(prior ? direct(line, tags, prior.start!, priorEnd, true) :
      unknown(base(line, priorEnd), tags));
  }
  return {
    calculation_version: SEC_CALCULATION_VERSION,
    period: { period_type: "annual" as const, fiscal_year: selected.fiscalYear,
      fiscal_period_label: `FY${selected.fiscalYear}`, period_start: selected.start,
      period_end: selected.end, reported_date: selected.filed, currency: "USD",
      is_latest: true, filing_reference: selected.accn, source: source(selected),
      is_demo: retrieval.is_demo },
    facts,
  };
}
