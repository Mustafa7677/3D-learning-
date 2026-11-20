import type { FlexModel } from "./plugin";

/** Item sizes used by both the 3D layout and the live CSS preview. */
export const ITEM_BASIS = 120;
export const ITEM_MIN_HEIGHTS = [60, 90, 70, 100, 80, 60, 90, 70];
export const COLUMN_HEIGHT = 360;
const MIN_SHRUNK = 30;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A faithful subset of the CSS flexbox algorithm for equal-basis items:
 * line breaking (flex-wrap), flex-shrink when a single line overflows,
 * justify-content on the main axis, align-items on the cross axis, and gap.
 */
export function computeFlex(f: FlexModel): { items: Rect[]; width: number; height: number } {
  const row = f.direction === "row";
  const mainSize = row ? f.containerWidth : COLUMN_HEIGHT;
  const n = f.items;
  const basis = (i: number) => (row ? ITEM_BASIS : ITEM_MIN_HEIGHTS[i % ITEM_MIN_HEIGHTS.length]!);
  const crossOf = (i: number) => (row ? ITEM_MIN_HEIGHTS[i % ITEM_MIN_HEIGHTS.length]! : ITEM_BASIS);

  // 1. Break into lines.
  const lines: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const need = basis(i) + (cur.length ? f.gap : 0);
    if (f.wrap && cur.length && used + need > mainSize) {
      lines.push(cur);
      cur = [];
      used = 0;
    }
    used += basis(i) + (cur.length ? f.gap : 0);
    cur.push(i);
  }
  if (cur.length) lines.push(cur);

  const items: Rect[] = new Array(n);
  let crossCursor = 0;
  for (const line of lines) {
    // 2. Main sizes, shrinking equally when the line overflows (flex-shrink: 1).
    const gaps = f.gap * (line.length - 1);
    const total = line.reduce((s, i) => s + basis(i), 0) + gaps;
    const overflow = Math.max(0, total - mainSize);
    const sizes = line.map((i) => Math.max(MIN_SHRUNK, basis(i) - (overflow * basis(i)) / Math.max(1, total - gaps)));
    const free = mainSize - sizes.reduce((a, b) => a + b, 0) - gaps;
    const lineCross = Math.max(...line.map(crossOf));

    // 3. justify-content
    let pos = 0;
    let between = f.gap;
    const k = line.length;
    if (free > 0) {
      if (f.justify === "center") pos = free / 2;
      else if (f.justify === "flex-end") pos = free;
      else if (f.justify === "space-between" && k > 1) between = f.gap + free / (k - 1);
      else if (f.justify === "space-around") {
        pos = free / k / 2;
        between = f.gap + free / k;
      }
    }

    line.forEach((i, j) => {
      const main = sizes[j]!;
      // 4. align-items
      const natural = crossOf(i);
      const cross = f.align === "stretch" ? lineCross : natural;
      const off = f.align === "center" ? (lineCross - cross) / 2 : f.align === "flex-end" ? lineCross - cross : 0;
      items[i] = row ? { x: pos, y: crossCursor + off, w: main, h: cross } : { x: crossCursor + off, y: pos, w: cross, h: main };
      pos += main + between;
    });
    crossCursor += lineCross + f.gap;
  }
  const crossTotal = Math.max(0, crossCursor - f.gap);
  return row ? { items, width: f.containerWidth, height: crossTotal } : { items, width: crossTotal, height: COLUMN_HEIGHT };
}

/** Self-contained preview document (no scripts) for a sandboxed iframe. */
export function flexPreviewHtml(f: FlexModel): string {
  const items = Array.from({ length: f.items }, (_, i) => `<div class="item" style="min-height:${ITEM_MIN_HEIGHTS[i % ITEM_MIN_HEIGHTS.length]}px">${i + 1}</div>`).join("");
  return `<!doctype html><style>
body{margin:12px;font:14px system-ui;background:#f4f6f9}
.container{display:flex;flex-direction:${f.direction};justify-content:${f.justify};align-items:${f.align};flex-wrap:${f.wrap ? "wrap" : "nowrap"};gap:${f.gap}px;width:${f.containerWidth}px;${f.direction === "column" ? `height:${COLUMN_HEIGHT}px;` : ""}outline:2px dashed #9aa6bd}
.item{box-sizing:border-box;flex:0 1 ${ITEM_BASIS}px;${f.direction === "row" ? "" : `width:${ITEM_BASIS}px;`}background:#2f5bea;color:#fff;border-radius:6px;padding:6px}
</style><div class="container">${items}</div>`;
}
