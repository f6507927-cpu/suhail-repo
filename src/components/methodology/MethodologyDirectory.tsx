import { Link } from "../../i18n/navigation";
import { useTranslations } from "next-intl";
import { PublicLocalizedText as LocalizedText, Num } from "../foundation";
import type { PublicMethodologyGroup } from "../../db/methodology-public";
import { MethodologyCopy } from "./MethodologyCopy";
import { formatNumber } from "@/lib/format";
import { displayLabel } from "@/i18n/presentation";
import { publicMethodologyVersionLabel } from "@/i18n/methodology-labels";
import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";
import { isPreview } from "../../security/preview";
import { methodologyDisplay } from "@/i18n/methodology-display";

export function MethodologyDirectory({
  groups: storedGroups,
  locale,
}: {
  groups: PublicMethodologyGroup[];
  locale: string;
}) {
  const t = useTranslations("methodologies");
  const controls = useTranslations("controls");
  const publicText = useTranslations("publicMethodology");
  const display = (value: string) => methodologyDisplay(value, locale === "ar" ? "ar" : "en");
  // Directory presentation only. Do not change public flags, records or versions.
  const groups = isPreview() ? storedGroups : storedGroups.flatMap(group => {
    if (group.is_demo || group.official_or_inspired === "internal_example" || group.slug === "example-methodology") return [];
    const versions = group.versions.filter(version => !version.is_demo);
    return versions.length ? [{ ...group, versions }] : [];
  });
  return (
    <main id="content" className="mx-auto min-h-[55vh] max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pt-16">
      <div className="grid gap-10 border-b border-[var(--divider)] pb-12 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end">
        <div className="max-w-3xl">
          <h1 className="text-4xl leading-tight sm:text-5xl">
            <LocalizedText>{t("title")}</LocalizedText>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            <LocalizedText>{t("subtitle")}</LocalizedText>
          </p>
        </div>
        <div className="border-s-2 border-[var(--brass)] ps-5">
          <span className="block text-sm text-muted-foreground">
            <MethodologyCopy id="documentedMethods" />
          </span>
          <Num className="mt-2 block text-4xl text-[var(--brass-soft)]">
            {formatNumber(groups.length, locale === "ar" ? "ar" : "en")}
          </Num>
        </div>
      </div>

      {groups.length === 0 ? (
        <section className="my-12 border border-[var(--divider)] bg-card px-6 py-10 sm:px-9">
          <h2 className="mt-3 text-2xl">
            <LocalizedText>{controls("emptyTitle")}</LocalizedText>
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            <LocalizedText>{controls("emptyBody")}</LocalizedText>
          </p>
        </section>
      ) : (
        <section aria-label={publicText("methodologyRecords")} className="space-y-4">
          {groups.map((group, index) => {
            const current = group.versions[0];
            const latest = publicMethodologyVersionLabel(uiOneDisplay(current?.version_label || current?.version || "", locale === "ar" ? "ar" : "en"));
            return (
              <article
                key={group.id}
                className="grid gap-6 rounded-[var(--radius-card)] bg-card p-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-8 sm:p-8"
              >
                <span className="font-mono text-sm tabular-nums text-[var(--byline)]" dir="ltr">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{displayLabel("methodType", group.type, locale === "ar" ? "ar" : "en")}</span>
                    {group.publisher && <span className="border-s border-[var(--divider)] ps-3">{display(group.publisher)}</span>}
                  </div>
                  <h2 className="text-2xl leading-snug sm:text-3xl">
                    <Link
                      href={`/methodology/${group.slug}`}
                      className="decoration-[var(--brass)] decoration-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]"
                    >
                      {display(group.name)}
                    </Link>
                  </h2>
                  {group.short_label && (
                    <p className="mt-2 text-sm text-[var(--brass-soft)]">{display(group.short_label)}</p>
                  )}
                  {group.scope && <p className="mt-3 max-w-3xl text-muted-foreground">{display(group.scope)}</p>}
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span>
                      <span className="text-muted-foreground"><LocalizedText>{t("version")}</LocalizedText>: </span>
                      {current?.version_label
                        ? <span>{display(latest ?? "—")}</span>
                        : <bdi dir="ltr" className="font-mono">{display(latest ?? "—")}</bdi>}
                    </span>
                    <span>
                      <span className="text-muted-foreground"><MethodologyCopy id="publicVersions" />: </span>
                      <Num>{formatNumber(group.versions.length, locale === "ar" ? "ar" : "en")}</Num>
                    </span>
                  </div>
                </div>
                <div className="flex items-start sm:justify-end">
                  <Link
                    href={`/methodology/${group.slug}`}
                    className="inline-flex min-h-11 items-center gap-3 border border-[var(--divider)] px-4 text-sm transition-colors hover:border-[var(--brass)] hover:text-[var(--brass-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]"
                  >
                    <MethodologyCopy id="openDocumentation" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
