/** D-40/D-51: classify decoded route segments, never attacker-supplied headers. */
export function privatePath(pathname: string) {
  try {
    const path = decodeURIComponent(pathname);
    return { path, malformed: false, private: /^\/(?:en\/|ar\/)?(?:auth|account|admin)(?:\/|$)/.test(path) };
  } catch {
    return { path: pathname, malformed: true, private: true };
  }
}
