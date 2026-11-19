// Only the isolated component test bundle uses this router boundary.
// The actual Next application retains its authenticated routes/actions unchanged.
function navigate(href: string, replace: boolean) {
  // Public home is an actual synthetic destination served by this harness.
  // Protected destinations are recorded only, never sent to the real app.
  if (href === "/" || href === "/en") {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
  } else if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
}
export function useRouter() {return {
  refresh(){}, prefetch(){},
  push(href: string){ navigate(href, false); },
  replace(href: string){ navigate(href, true); },
};}
export function usePathname() { return window.location.pathname; }
// next-intl imports both exports even for Link-only usage. A server redirect
// is unsupported in this component harness: fail explicitly, never bypass auth.
export function redirect(): never { throw new Error("Unexpected server redirect in component fixture"); }
export const permanentRedirect = redirect;
