import { revalidatePath } from "next/cache";

/** D-20: best effort for this instance, not coordinated Autoscale caches.
 * Pattern invalidation avoids internal slug reads after the committed mutation.
 * No layout-wide invalidation: only surfaces consuming the changed evidence.
 */
export function revalidatePublic(surface: "financial" | "screening" | "methodology" | "settings") {
  for (const prefix of ["", "/en"]) {
    // D-145/D-146: featured evidence and default metadata also appear on home.
    revalidatePath(prefix || "/", "page");
    revalidatePath(`${prefix}/stock/[slug]`, "page");
    revalidatePath(`${prefix}/search`, "page");
    if (surface === "methodology" || surface === "settings") {
      revalidatePath(`${prefix}/methodology`, "page");
      revalidatePath(`${prefix}/methodology/[slug]`, "page");
    }
  }
}
