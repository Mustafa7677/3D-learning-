/** Сөзжұмбақ: a crossword of the platform's terms, for the newspaper issue. */

export type Dir = "across" | "down";

export interface Entry {
  word: string;
  row: number;
  col: number;
  dir: Dir;
  clue: string;
  /** The lab where the term is taught. */
  lab: string;
}

/** Issue 1. The layout was generated so every word crosses another and no two run side by side. */
export const ISSUE_1: Entry[] = [
  { word: "ДАТЧИК", row: 0, col: 2, dir: "across", lab: "iot", clue: "Температураны, жарықты не қозғалысты өлшеп, санға айналдыратын құрылғы." },
  { word: "ИНДЕКС", row: 0, col: 6, dir: "down", lab: "db", clue: "Дерекқорда іздеуді жылдамдататын көрсеткіш: кітаптың соңындағы тізім сияқты." },
  { word: "НЕЙРОН", row: 3, col: 5, dir: "across", lab: "ai", clue: "Кірістерді салмақпен қосып, бір шешім шығаратын желінің ең кіші бөлшегі." },
  { word: "ПРОЦЕССОР", row: 5, col: 0, dir: "across", lab: "arch", clue: "Нұсқауларды бір-бірлеп алып, орындайтын компьютердің «миы»." },
  { word: "СЕРВЕР", row: 5, col: 5, dir: "down", lab: "web", clue: "Сұранысқа бетпен не дерекпен жауап беретін компьютер." },
  { word: "АЛГОРИТМ", row: 7, col: 1, dir: "across", lab: "algo", clue: "Есепті шешудің нақты, ретті қадамдары." },
  { word: "МАРШРУТ", row: 7, col: 8, dir: "down", lab: "net", clue: "Пакеттің бір түйіннен екіншісіне баратын жолы." },
  { word: "ПАКЕТ", row: 9, col: 2, dir: "across", lab: "net", clue: "Желіде жеке жіберілетін деректер бөлігі: тақырыбы мен мекенжайы бар." },
  { word: "ШИФР", row: 10, col: 8, dir: "across", lab: "sec", clue: "Хабарды кілтсіз оқылмайтын етіп өзгертетін тәсіл." },
  { word: "КЕСТЕ", row: 13, col: 5, dir: "across", lab: "db", clue: "Дерекқордағы жолдар мен бағандардан тұратын құрылым." },
];

export const key = (r: number, c: number) => `${r}:${c}`;

export interface Cell {
  r: number;
  c: number;
  answer: string;
  /** The clue number printed in the corner, if a word starts here. */
  num?: number;
}

export interface Board {
  rows: number;
  cols: number;
  cells: Map<string, Cell>;
  /** Entries with their printed numbers, in reading order. */
  entries: (Entry & { num: number })[];
}

export function cellsOf(e: Pick<Entry, "word" | "row" | "col" | "dir">): [number, number][] {
  return [...e.word].map((_, i) => (e.dir === "down" ? [e.row + i, e.col] : [e.row, e.col + i]));
}

/** Build the board and number the starts in reading order; throws if two words disagree on a letter. */
export function buildBoard(entries: Entry[]): Board {
  const cells = new Map<string, Cell>();
  let rows = 0;
  let cols = 0;
  for (const e of entries) {
    cellsOf(e).forEach(([r, c], i) => {
      const ch = [...e.word][i]!;
      const prev = cells.get(key(r, c));
      if (prev && prev.answer !== ch) throw new Error(`Letters disagree at ${r},${c}: ${prev.answer} / ${ch}`);
      cells.set(key(r, c), { r, c, answer: ch });
      rows = Math.max(rows, r + 1);
      cols = Math.max(cols, c + 1);
    });
  }
  const starts = [...new Set(entries.map((e) => key(e.row, e.col)))].sort((a, b) => {
    const [ar, ac] = a.split(":").map(Number);
    const [br, bc] = b.split(":").map(Number);
    return ar! - br! || ac! - bc!;
  });
  starts.forEach((k, i) => (cells.get(k)!.num = i + 1));
  const numbered = entries
    .map((e) => ({ ...e, num: cells.get(key(e.row, e.col))!.num! }))
    .sort((a, b) => a.num - b.num || (a.dir === "across" ? -1 : 1));
  return { rows, cols, cells, entries: numbered };
}

/** Kazakh upper case for one typed character; anything that is not a letter is dropped. */
export function normalizeLetter(input: string): string {
  const ch = [...input.trim()].at(-1) ?? "";
  const up = ch.toLocaleUpperCase("kk-KZ");
  return /^\p{L}$/u.test(up) ? up : "";
}

export interface CheckResult {
  filled: number;
  total: number;
  wrong: string[];
  solved: boolean;
}

export function check(board: Board, letters: Record<string, string>): CheckResult {
  let filled = 0;
  const wrong: string[] = [];
  for (const [k, cell] of board.cells) {
    const v = letters[k];
    if (!v) continue;
    filled++;
    if (v !== cell.answer) wrong.push(k);
  }
  const total = board.cells.size;
  return { filled, total, wrong, solved: filled === total && wrong.length === 0 };
}

/** The words that are complete and right, for crossing them off the clue list. */
export function solvedEntries(board: Board, letters: Record<string, string>): Set<number> {
  const out = new Set<number>();
  board.entries.forEach((e, i) => {
    if (cellsOf(e).every(([r, c]) => letters[key(r, c)] === board.cells.get(key(r, c))!.answer)) out.add(i);
  });
  return out;
}

/** Saved letters only for real cells and only single letters. */
export function sanitizeLetters(board: Board, raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (board.cells.has(k) && typeof v === "string" && normalizeLetter(v) === v && v) out[k] = v;
  }
  return out;
}
