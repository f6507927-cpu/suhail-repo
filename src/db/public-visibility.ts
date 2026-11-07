import { and, eq, ne, type SQL } from "drizzle-orm";
import { methodology, methodologyVersion, source } from "./schema";
import { publicDemoContentVisible } from "../lib/public-demo";

/**
 * Public demo hiding. Each helper returns undefined when local fixtures opt in,
 * so `and(...)` keeps the fixture query unchanged. production_blocked is the
 * permanent D-93 latch (granted to suhail_public by 0021); the derived columns
 * are kept too so an unlatched row with demo markers still stays hidden.
 */
export const hidePublicDemo = () => !publicDemoContentVisible();

export function genuineMethodology(): SQL | undefined {
  return hidePublicDemo() ? and(eq(methodology.is_demo, false), eq(methodology.production_blocked, false),
    ne(methodology.official_or_inspired, "internal_example")) : undefined;
}
export function genuineMethodologyVersion(): SQL | undefined {
  return hidePublicDemo() ? and(eq(methodologyVersion.is_demo, false), eq(methodologyVersion.production_blocked, false)) : undefined;
}
export function genuineSource(): SQL | undefined {
  return hidePublicDemo() ? and(eq(source.is_demo, false), eq(source.is_synthetic, false), eq(source.production_blocked, false)) : undefined;
}
/** Raw-SQL equivalent for search: true when the row may be shown. */
export function demoVisibleSql(): boolean {
  return publicDemoContentVisible();
}
