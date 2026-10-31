import { utimesSync } from "node:fs";
import { methodologyCacheFile } from "./methodology-isr-cache";

// Test-only cache artifact preparation, never a database or source mutation.
// Age runtime-generated directory/detail caches beyond the real ISR interval.
const stale = new Date(Date.now() - 901_000);
for (const locale of ["ar", "en"]) {
  for (const page of ["methodology", "methodology/example-a"]) {
    utimesSync(methodologyCacheFile(locale, page), stale, stale);
  }
}
