// The root entry is an alias for the methodology workspace, not a second section.
export function activeAdminSection(path: string) {
  const pathname = path.split(/[?#]/)[0].replace(/^\/(?:en|ar)(?=\/)/, "").replace(/\/+$/, "");
  if (pathname === "/admin") return "/admin";
  const section = pathname.split("/")[2];
  return section === "methodologies" ? "/admin" : `/admin/${section}`;
}
