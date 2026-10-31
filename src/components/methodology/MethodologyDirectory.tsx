import { Link } from "../../i18n/navigation";
import { useTranslations } from "next-intl";
import { LocalizedText, Num } from "../foundation";
import type { PublicMethodologyGroup } from "../../db/methodology-public";
import { MethodologyCopy } from "./MethodologyCopy";
import { formatNumber } from "@/lib/format";
import { displayLabel } from "@/i18n/presentation";

export function MethodologyDirectory({
  groups,
  locale,
}: {
  groups: PublicMethodologyGroup[];
  locale: string;
}) {
  const t = useTranslations("methodologies");
  const controls = useTranslations("controls");
  const publicText = useTranslations("publicMethodology");
  return (
    <main id="content" className="mx-auto min-h-[55vh] max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pt-16">
      <div className="grid gap-10 border-b border-[var(--divider)] pb-12 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm text-[var(--byline)]">
            <MethodologyCopy id="publicResearchDocumentation" />
          </p>
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
          <p className="text-sm text-[var(--byline)]">
            <MethodologyCopy id="researchRegister" />
          </p>
          <h2 className="mt-3 text-2xl">
            <LocalizedText>{controls("emptyTitle")}</LocalizedText>
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            <LocalizedText>{controls("emptyBody")}</LocalizedText>
          </p>
        </section>
      ) : (
        <section aria-label={publicText("methodologyRecords")} className="divide-y divide-[var(--divider)]">
          {groups.map((group, index) => {
            const current = group.versions[0];
            const latest = current?.version_label ?? current?.version;
            return (
              <article
                key={group.id}
                className="grid gap-6 py-8 first:pt-9 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-8 sm:py-10"
              >
                <span className="font-mono text-sm tabular-nums text-[var(--byline)]" dir="ltr">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{displayLabel("methodType", group.type, locale === "ar" ? "ar" : "en")}</span>
                    {group.publisher && <span className="border-s border-[var(--divider)] ps-3">{group.publisher}</span>}
                  </div>
                  <h2 className="text-2xl leading-snug sm:text-3xl">
                    <Link
                      href={`/methodology/${group.slug}`}
                      className="decoration-[var(--brass)] decoration-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]"
                    >
                      {group.name}
                    </Link>
                  </h2>
                  {group.short_label && (
                    <p className="mt-2 text-sm text-[var(--brass-soft)]">{group.short_label}</p>
                  )}
                  {group.scope && <p className="mt-3 max-w-3xl text-muted-foreground">{group.scope}</p>}
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span>
                      <span className="text-muted-foreground"><LocalizedText>{t("version")}</LocalizedText>: </span>
                      {current?.version_label
                        ? <span>{latest}</span>
                        : <bdi dir="ltr" className="font-mono">{latest ?? "—"}</bdi>}
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
                    <span aria-hidden="true">↗</span>
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
