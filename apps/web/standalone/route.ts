/**
 * Hash routing for the standalone build. Only plain `#name` hashes survive
 * the artifact host, so app paths map to single names:
 *   /                 → ""            (home)
 *   /labs/ai          → "#ai"
 *   /labs/ai/<lesson> → "#<lesson>"
 */
export function pathToHash(href: string): string {
  if (href.startsWith("#") || /^[a-z]+:/i.test(href)) return href;
  const parts = href.split("/").filter(Boolean);
  if (parts.length === 0) return "#";
  if (parts[0] === "labs" && parts[1] && parts.length === 2) return `#${parts[1]}`;
  if (parts[0] === "labs" && parts.length >= 3) return `#${parts[parts.length - 1]}`;
  if (parts.length === 1) return `#${parts[0]}`;
  return "#";
}
