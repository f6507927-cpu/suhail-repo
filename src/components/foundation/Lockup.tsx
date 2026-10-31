import { useLocale } from "next-intl";
import { BrandMark } from "./BrandMark";

export function Lockup({ surface = "dark" }: { surface?: "dark" | "light" }) {
  const locale = useLocale();

  return (
    <span
      className="inline-flex items-center gap-3"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <BrandMark surface={surface} className="size-7 shrink-0" />
      <span className="flex flex-col">
        <span className="inline-flex items-baseline gap-2 leading-none">
          <span
            lang="ar"
            className={`text-2xl font-semibold ${surface === "dark" ? "text-brass-soft" : "text-foreground"}`}
          >
            سهيل
          </span>
          <span lang="en" className="text-xl font-semibold">
            Suhail
          </span>
        </span>
        <span lang="ar" className="mt-1 text-xs font-normal leading-[1.9]">
          سهيل · استثمار متوافق
        </span>
      </span>
    </span>
  );
}
