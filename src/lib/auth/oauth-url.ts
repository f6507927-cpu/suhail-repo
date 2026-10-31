// D-46: only the configured Supabase Google authorization endpoint may be navigated to.
export function googleOAuthUrl(value: unknown, configuredUrl: string | undefined): string {
  if (typeof value !== "string" || !configuredUrl) throw new Error("invalid_oauth_destination");
  const base = new URL(configuredUrl);
  const url = new URL(value);
  if (base.protocol !== "https:" || base.username || base.password ||
      url.origin !== base.origin || url.username || url.password ||
      url.pathname !== "/auth/v1/authorize" || url.hash ||
      url.searchParams.getAll("provider").length !== 1 || url.searchParams.get("provider") !== "google") {
    throw new Error("invalid_oauth_destination");
  }
  return url.href;
}
