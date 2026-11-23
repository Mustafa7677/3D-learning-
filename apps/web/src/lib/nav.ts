/** Navigate from code (e.g. a click on a 3D object) in both the Next app and the hash-routed standalone build. */
export function go(href: string) {
  if (process.env.NEXT_PUBLIC_STANDALONE === "1") {
    const parts = href.split("/").filter(Boolean);
    window.location.hash = parts.length === 0 ? "" : parts[parts.length - 1]!;
    return;
  }
  window.location.assign(href);
}

/** A query parameter from the URL, or from the hash in the standalone build ("#problems?p=bdp"). */
export function queryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const direct = new URLSearchParams(window.location.search).get(name);
  if (direct !== null) return direct;
  const q = window.location.hash.split("?")[1];
  return q ? new URLSearchParams(q).get(name) : null;
}

/** True when the visitor asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
