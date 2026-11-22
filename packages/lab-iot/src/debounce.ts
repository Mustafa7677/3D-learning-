/**
 * Button bounce: a mechanical contact chatters for a few milliseconds when it
 * closes and opens. Sampled at 1 kHz over one second, three real presses
 * (the last two quick, like a double click) look like many. A debouncer only
 * believes a new level once it has held for W milliseconds.
 */

export const SAMPLES = 1000; // 1 ms each
/** Real presses: [down, up] in ms. */
export const PRESSES: [number, number][] = [
  [100, 250],
  [600, 650],
  [700, 760],
];
/** Each edge chatters: the contact flips at these offsets (ms) after the edge before it settles. */
const BOUNCE = [0, 1, 2, 3, 4];

export function rawSignal(): number[] {
  const s = Array.from({ length: SAMPLES }, () => 0);
  for (const [down, up] of PRESSES) for (let t = down; t < up; t++) s[t] = 1;
  for (const [down, up] of PRESSES)
    for (const edge of [down, up])
      BOUNCE.forEach((o, i) => {
        // Odd offsets flip the contact back for 1 ms.
        if (i % 2 === 1) s[edge + o] = s[edge + o] === 1 ? 0 : 1;
      });
  return s;
}

export const risingEdges = (s: number[]) => s.reduce((n, v, i) => n + (i > 0 && v === 1 && s[i - 1] === 0 ? 1 : 0), 0);

/** Change the output only after the raw level has differed from it for `window` consecutive ms. */
export function debounce(s: number[], window: number): number[] {
  let out = 0;
  let run = 0;
  return s.map((v) => {
    if (v !== out) {
      run++;
      if (run >= window) {
        out = v;
        run = 0;
      }
    } else run = 0;
    return out;
  });
}

export function countPresses(window: number): { raw: number; counted: number; latency: number } {
  const s = rawSignal();
  const d = window <= 0 ? s : debounce(s, window);
  return { raw: risingEdges(s), counted: risingEdges(d), latency: Math.max(0, window) };
}
