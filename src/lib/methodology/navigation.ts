import { localePath } from "@/lib/auth/paths";

export type MethodologySelection = { methodology?: string; version?: string };
export function methodologyHref(locale: string, selection: MethodologySelection = {}, anchor?: string) {
  const query = new URLSearchParams();
  if (selection.methodology) query.set("methodology", selection.methodology);
  if (selection.version) query.set("version", selection.version);
  return `${localePath(locale, "/admin/methodologies")}${query.size ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}
