import { defineRouting } from "next-intl/routing";

// D-21: URL only; never browser language or a locale cookie.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});
export type Locale = (typeof routing.locales)[number];
