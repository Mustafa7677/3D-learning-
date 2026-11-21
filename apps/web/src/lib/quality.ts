"use client";

import { useEffect, useState } from "react";

export type Quality = "high" | "low";

/**
 * A coarse device class for the 3D pages. Phones, tablets and machines with
 * few cores or little memory get "low": smaller render scale, fewer
 * particles, no bloom. `?quality=low|high` in the URL overrides it.
 */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || cores <= 4 || memory <= 4 ? "low" : "high";
}

export function useQuality(): Quality {
  const [q, setQ] = useState<Quality>("high");
  useEffect(() => setQ(detectQuality()), []);
  return q;
}

/** Canvas settings per quality. */
export const QUALITY = {
  high: { dpr: [1, 1.75] as [number, number], dust: 700, bloom: true },
  low: { dpr: [1, 1.25] as [number, number], dust: 220, bloom: false },
};
