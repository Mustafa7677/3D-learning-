/**
 * Object pooling: 300 frames of a shooter. Each frame fires bullets that
 * live 30 frames. Without a pool every bullet is a new object and becomes
 * garbage when it dies; the garbage collector stops the game when enough has
 * piled up. With a pool, dead bullets are reused and nothing is thrown away.
 */

export const FRAMES = 300;
export const BASE_MS = 8;
export const BUDGET_MS = 1000 / 60; // 16.7 ms for 60 FPS
export const LIFETIME = 30;
export const GC_THRESHOLD = 3000; // dead objects before the collector runs
export const GC_MS_PER_OBJECT = 0.01;

export interface PoolRun {
  /** Milliseconds each frame took. */
  frames: number[];
  /** Frames over the 60 FPS budget. */
  janky: number;
  worst: number;
  gcRuns: number;
  allocations: number;
  /** Bullets the pool ended up holding (0 without a pool). */
  poolSize: number;
}

export function runPool(perFrame: number, pooled: boolean): PoolRun {
  const born: number[] = []; // birth frame of each live bullet
  let garbage = 0;
  let allocations = 0;
  let pool = 0; // free bullets waiting in the pool
  let poolSize = 0;
  let gcRuns = 0;
  const frames: number[] = [];
  for (let f = 0; f < FRAMES; f++) {
    // Bullets older than LIFETIME die.
    while (born.length && f - born[0]! >= LIFETIME) {
      born.shift();
      if (pooled) pool++;
      else garbage++;
    }
    for (let i = 0; i < perFrame; i++) {
      if (pooled && pool > 0) pool--;
      else {
        allocations++;
        if (pooled) poolSize++;
      }
      born.push(f);
    }
    let ms = BASE_MS + perFrame * 0.02;
    if (garbage >= GC_THRESHOLD) {
      ms += garbage * GC_MS_PER_OBJECT;
      garbage = 0;
      gcRuns++;
    }
    frames.push(Math.round(ms * 100) / 100);
  }
  return { frames, janky: frames.filter((m) => m > BUDGET_MS).length, worst: Math.max(...frames), gcRuns, allocations, poolSize };
}
