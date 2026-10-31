import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { DISPLAY_TIME_ZONE } from "../lib/format";

export default getRequestConfig(async ({ requestLocale }) => {
  // Layout/pages call setRequestLocale before any hooks: cached locale avoids
  // next-intl's request-header fallback, preserving D-21/D-22 static rendering.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: DISPLAY_TIME_ZONE,
  };
});
