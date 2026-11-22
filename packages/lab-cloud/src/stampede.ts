/**
 * A cache in front of a database, second by second. One hot key is read 500
 * times a second; the database can answer 50 queries a second, and filling
 * the key takes 2 s. What happens when the key expires depends on who goes to
 * the database: everyone (a stampede), only one (single-flight), or a quiet
 * background refresh before it expires.
 */

export type CacheStrategy = "none" | "ttl" | "coalesce" | "early";
export const STAMPEDE_SECONDS = 60;
export const HOT_RPS = 500;
export const DB_CAP = 50;
export const CACHE_TTL = 20;
export const FILL = 2;
/** Refresh-ahead starts this many seconds before expiry. */
export const EARLY = 3;

export interface StampedeRun {
  /** Per second: queries hitting the database, whether users were served from the cache, whether they waited. */
  timeline: { db: number; hit: boolean; slow: boolean }[];
  dbPeak: number;
  /** Seconds the database had more queries than it can answer. */
  overload: number;
  /** Seconds users waited for a fill. */
  slow: number;
  /** Requests the overloaded database failed. */
  errors: number;
  hitRate: number;
}

export function runStampede(strategy: CacheStrategy): StampedeRun {
  const timeline: StampedeRun["timeline"] = [];
  let cachedUntil = -1;
  let fillDone = -1; // -1: no fill in flight
  for (let t = 0; t < STAMPEDE_SECONDS; t++) {
    if (fillDone >= 0 && t >= fillDone) {
      cachedUntil = fillDone + CACHE_TTL;
      fillDone = -1;
    }
    if (strategy === "none") {
      timeline.push({ db: HOT_RPS, hit: false, slow: true });
      continue;
    }
    const hit = t < cachedUntil;
    let db = 0;
    if (hit) {
      if (strategy === "early" && fillDone < 0 && t >= cachedUntil - EARLY) {
        fillDone = t + FILL;
        db = 1;
      }
      timeline.push({ db, hit: true, slow: false });
      continue;
    }
    const starting = fillDone < 0;
    if (starting) fillDone = t + FILL;
    // Cache-aside without coordination: every request that misses queries the database itself.
    db = strategy === "ttl" ? HOT_RPS : starting ? 1 : 0;
    timeline.push({ db, hit: false, slow: true });
  }
  const over = timeline.filter((x) => x.db > DB_CAP);
  return {
    timeline,
    dbPeak: Math.max(...timeline.map((x) => x.db)),
    overload: over.length,
    slow: timeline.filter((x) => x.slow).length,
    errors: over.reduce((a, x) => a + x.db - DB_CAP, 0),
    hitRate: Math.round((timeline.filter((x) => x.hit).length / STAMPEDE_SECONDS) * 100) / 100,
  };
}
