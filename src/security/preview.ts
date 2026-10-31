export function isPreview() { return process.env.SITE_MODE !== "live"; }

/** Only build/static assets, not extension-based arbitrary route exemptions. */
export function approvedAsset(path: string) {
  // Turbopack emits encoded brackets and @ in static chunk filenames. These
  // cannot change path segments; keep rejecting encoded separators/dots/escapes.
  const checked = path.replace(/%(?:5b|5d|40)/gi, "_");
  if (checked.includes("%") || path.includes("\\") || path.split("/").some(part => part === "." || part === "..")) return false;
  return ["/_next/static/", "/brand/", "/icons/", "/fonts/"].some(prefix => path.startsWith(prefix));
}
