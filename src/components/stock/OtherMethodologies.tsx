import { StatusBadge, Num } from "../foundation";
import { Bilingual, Copy } from "./StockVerdictParts";
import { stockCriterionLabel } from "@/i18n/stock-labels";
import { displayLabel } from "@/i18n/presentation";
import { formatNumber } from "@/lib/format";
import type { OtherMethodologyResult, PublicStockData } from "@/stock/types";
import { MethodologySwitcher } from "./MethodologySwitcher";
import styles from "./OtherMethodologies.module.css";
import { methodologyPublicName } from "@/i18n/methodology-public-names";

type Locale = "ar" | "en";
type Criterion = OtherMethodologyResult["criteria"][number];

/** The criterion that decided the status: the first failure, else the first
 * unknown; a passing result has none. Each methodology stands alone (D-174). */
export function decidingCriterion(result: OtherMethodologyResult): Criterion | null {
  return result.criteria.find(c => c.result === "fail") ?? result.criteria.find(c => c.result === "unknown") ??
    result.criteria.find(c => c.result === "borderline") ?? null;
}
function percent(value: number | null, locale: Locale) {
  return value === null ? "—" : `${formatNumber(value, locale, { maximumFractionDigits: 2 })}%`;
}
function fact(data: PublicStockData, line: string) {
  return data.facts.find(f => f.line_item === line) ?? null;
}
/** D-172: show the total-debt components when finance leases are included. */
function DebtComponents({ data, criterion, locale }: { data: PublicStockData; criterion: Criterion; locale: Locale }) {
  if (criterion.criterion_type !== "interest_bearing_debt" || !/finance lease/i.test(criterion.numerator_definition ?? "")) return null;
  const parts = ["interest_bearing_debt", "finance_lease_liabilities"].map(line => ({ line, row: fact(data, line) }));
  return (
    <dl className={styles.components} data-debt-components>
      {parts.map(({ line, row }) => (
        <div key={line}>
          <dt>{displayLabel("lineItem", line, locale)}</dt>
          <dd>{row?.value === null || row?.value === undefined ? <Copy locale={locale}>Unknown</Copy> : <Num>${formatNumber(row.value, locale)}</Num>}</dd>
        </div>
      ))}
      <div>
        <dt><Copy locale={locale}>Total debt used</Copy></dt>
        <dd>{criterion.numerator_value === null ? <Copy locale={locale}>Unknown</Copy> : <Num>${formatNumber(criterion.numerator_value, locale)}</Num>}</dd>
      </div>
    </dl>
  );
}
function ResultCard({ data, result, locale }: { data: PublicStockData; result: OtherMethodologyResult; locale: Locale }) {
  const decided = decidingCriterion(result);
  const href = `${locale === "en" ? "/en" : ""}/methodology/${result.methodology.slug}`;
  return (
    <article className={styles.card} data-methodology-card={result.methodology.slug}>
      <h3 className={styles.name}><Bilingual locale={locale} arabic={methodologyPublicName(result.methodology.short_label ?? result.methodology.name, "ar")} english={result.methodology.short_label ?? result.methodology.name} /></h3>
      {result.run ? (
        <>
          <StatusBadge status={result.run.status} />
          <p className={styles.reason}>
            {decided ? (
              <>
                <span className={styles.reasonLabel}><Copy locale={locale}>Decided by</Copy></span>{" "}
                <Bilingual locale={locale} arabic={null} english={stockCriterionLabel(decided, locale)} />
                {decided.ratio !== null && decided.threshold !== null && (
                  // One LTR run so Arabic pages keep "ratio / limit" order.
                  <> {" "}<Num>{`${percent(decided.ratio, locale)} / ${percent(decided.threshold, locale)}`}</Num></>
                )}
              </>
            ) : <Copy locale={locale}>Every criterion passed.</Copy>}
          </p>
          {result.criteria.map(c => <DebtComponents key={c.criterion_id} data={data} criterion={c} locale={locale} />)}
        </>
      ) : <p className={styles.reason}><Copy locale={locale}>Not yet screened under this methodology.</Copy></p>}
      <a className={styles.link} href={href}><Copy locale={locale}>How this methodology works</Copy></a>
    </article>
  );
}
/** D-174: compact, separate results under each other production-enabled public
 * methodology. Server-rendered for ISR; the switcher only chooses which to show. */
export function OtherMethodologies({ data, locale }: { data: PublicStockData; locale: Locale }) {
  const others = data.otherMethodologies ?? [];
  if (!others.length || !data.methodology) return null;
  return (
    <section className={styles.section} data-section="other-methodologies" aria-labelledby="other-methodologies-title">
      <h2 id="other-methodologies-title" className={styles.title}><Copy locale={locale}>Other methodologies</Copy></h2>
      <p className={styles.note}><Copy locale={locale}>Each methodology gives its own result. They are not combined into one score.</Copy></p>
      <MethodologySwitcher
        defaultSlug={data.methodology.slug}
        options={[
          { slug: data.methodology.slug, label: <Bilingual locale={locale} arabic={methodologyPublicName(data.methodology.name, "ar")} english={data.methodology.name} />, isDefault: true },
          ...others.map(o => ({ slug: o.methodology.slug, label: <Bilingual locale={locale} arabic={methodologyPublicName(o.methodology.short_label ?? o.methodology.name, "ar")} english={o.methodology.short_label ?? o.methodology.name} />, isDefault: false })),
        ]}
        legend={<Copy locale={locale}>Show the result under</Copy>}
        defaultNote={<p className={styles.reason}><Copy locale={locale}>The result above uses the site&apos;s default methodology.</Copy></p>}
        cards={Object.fromEntries(others.map(o => [o.methodology.slug, <ResultCard key={o.methodology.slug} data={data} result={o} locale={locale} />]))}
      />
    </section>
  );
}
