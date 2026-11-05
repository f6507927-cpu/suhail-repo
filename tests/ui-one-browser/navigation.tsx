import type { ComponentProps } from "react";
import { useLocale } from "next-intl";
// SSR-safe navigation stand-in for the isolated fixture server only.
export function Link({ href, ...props }: ComponentProps<"a">) {
  const locale = useLocale();
  const target = typeof href === "string" ? href : "/";
  return <a href={`${locale === "en" ? "/en" : ""}${target}`} {...props} />;
}
export function usePathname() { return "/"; }
export function getPathname() { return "/"; }
