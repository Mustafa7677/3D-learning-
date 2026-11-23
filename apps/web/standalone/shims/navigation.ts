/**
 * Stand-in for next/navigation in the standalone build (hash routing, no Next router).
 * Without it, any component that asks for the router or the path throws, and the page is blank.
 */
import { useSyncExternalStore } from "react";
import { lessonEntries } from "../../src/lib/lessons";
import { openLabs } from "../../src/lib/catalog";
import { pathToHash } from "../route";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const hashName = () => decodeURIComponent(window.location.hash.replace(/^#/, "")).split("?")[0] ?? "";

/** The app path the current hash stands for: "#la-1-vectors" → "/labs/math/la-1-vectors". */
export function hashToPath(name: string): string {
  if (!name) return "/";
  const lesson = lessonEntries.find((e) => e.lesson.id === name);
  if (lesson) return `/labs/${lesson.labId}/${name}`;
  if (openLabs.some((l) => l.id === name)) return `/labs/${name}`;
  return `/${name}`;
}

export function usePathname(): string {
  const name = useSyncExternalStore(subscribe, hashName, () => "");
  return hashToPath(name);
}

export function useRouter() {
  return {
    push: (href: string) => {
      window.location.hash = pathToHash(href);
    },
    replace: (href: string) => {
      window.location.replace(pathToHash(href));
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => undefined,
    prefetch: () => undefined,
  };
}

export function useSearchParams(): URLSearchParams {
  const q = useSyncExternalStore(subscribe, () => window.location.hash.split("?")[1] ?? "", () => "");
  return new URLSearchParams(q);
}
