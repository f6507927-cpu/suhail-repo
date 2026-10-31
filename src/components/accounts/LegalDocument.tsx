import { legalDocument } from "../../lib/auth/legal";
import { LocalizedText } from "../foundation/shared";
import { reviewText } from "./types";
import { LegalMarkdown } from "./LegalMarkdown";
// Plain paragraphs/heading Markdown rendered as React text, never executable HTML.
export async function LegalDocument({
  kind,
  locale,
}: {
  kind: "terms" | "privacy";
  locale: string;
}) {
  const document = await legalDocument(kind, locale);
  return (
    <main id="content" className="mx-auto min-h-[45vh] max-w-3xl px-6 py-14">
      <h1 className="text-3xl">
        <LocalizedText>
          {reviewText(
            locale === "ar" ? "ar" : "en",
            kind === "terms" ? "Terms of Use" : "Privacy Policy",
          )}
        </LocalizedText>
      </h1>
      <p className="my-6 font-mono text-sm" dir="ltr">
        {document.version}
      </p>
      <p className="my-6 rounded border border-current p-4 text-lg">
        {locale === "ar" ? "مسودة — قيد المراجعة القانونية" : "Draft — under legal review"}
      </p>
      <article className="space-y-4">
        {/* D-140: review markers stay in the files for the launch gate; the banner above tells readers it is a draft. */}
        <LegalMarkdown markdown={document.markdown.replace(/⟦(?:LEGAL|AR)-REVIEW⟧[ \t]*/g, "")} />
      </article>
    </main>
  );
}
