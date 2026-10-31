export function shouldShowHeaderSearch(pathname: string) {
  const localizedPath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return localizedPath !== "/" && localizedPath !== "/search";
}
