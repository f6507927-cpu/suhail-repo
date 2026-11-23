import { localePath } from "@/lib/auth/paths";
import { reviewText, type Locale } from "../accounts/types";
export function ResearchEntryLink({ locale }: { locale: Locale }) {
  return <a className="mb-4 inline-flex min-h-11 items-center underline" href={localePath(locale, "/admin/research")}>
    {reviewText(locale, "Research drafts and controls")}
  </a>;
}
