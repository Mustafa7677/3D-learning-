/**
 * A tiny SQL engine for the Databases lesson. Supported:
 *   SELECT cols|* FROM t [WHERE cond [AND cond]...] [ORDER BY col [ASC|DESC]] [LIMIT n]
 *   INSERT INTO t (a, b) VALUES (1, 'x')
 *   UPDATE t SET a = 1, b = 'x' [WHERE ...]
 *   DELETE FROM t [WHERE ...]
 *   CREATE INDEX ON t (col)
 * cond: col (= | != | < | > | <= | >=) literal. Literals: numbers, 'strings'.
 * Every result reports how many rows were scanned and whether an index was used,
 * which is what makes indexes visible to the learner.
 */
export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Table {
  name: string;
  columns: string[];
  rows: Row[];
  /** Columns with an index (equality lookups use it instead of a full scan). */
  indexed: string[];
}

export type Db = Record<string, Table>;

export interface QueryResult {
  ok: boolean;
  error?: string;
  kind?: "select" | "insert" | "update" | "delete" | "index";
  rows: Row[];
  columns: string[];
  affected: number;
  scanned: number;
  usedIndex: string | null;
  /** Ids (row positions) the query touched, for highlighting in 3D. */
  touched: number[];
}

type Op = "=" | "!=" | "<" | ">" | "<=" | ">=";
interface Cond {
  col: string;
  op: Op;
  value: Value;
}

const fail = (error: string): QueryResult => ({ ok: false, error, rows: [], columns: [], affected: 0, scanned: 0, usedIndex: null, touched: [] });

function tokenize(sql: string): string[] {
  const out: string[] = [];
  const re = /\s*('(?:[^']|'')*'|-?\d+(?:\.\d+)?|<=|>=|!=|<>|[(),*=<>;]|[A-Za-z_][A-Za-z0-9_]*)/y;
  let m: RegExpExecArray | null;
  let pos = 0;
  const src = sql.trim();
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) throw new Error(`Түсініксіз таңба: «${src.slice(pos, pos + 10)}»`);
    out.push(m[1]!);
    pos = re.lastIndex;
    while (pos < src.length && /\s/.test(src[pos]!)) pos++;
  }
  if (out[out.length - 1] === ";") out.pop();
  return out;
}

class Parser {
  i = 0;
  constructor(private t: string[]) {}
  peek(): string | undefined {
    return this.t[this.i];
  }
  kw(word: string): boolean {
    if (this.peek()?.toUpperCase() === word) {
      this.i++;
      return true;
    }
    return false;
  }
  expectKw(word: string) {
    if (!this.kw(word)) throw new Error(`«${word}» күтілді, «${this.peek() ?? "соңы"}» табылды`);
  }
  expect(sym: string) {
    if (this.peek() !== sym) throw new Error(`«${sym}» күтілді, «${this.peek() ?? "соңы"}» табылды`);
    this.i++;
  }
  ident(): string {
    const x = this.peek();
    if (!x || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(x)) throw new Error(`Атау күтілді, «${x ?? "соңы"}» табылды`);
    this.i++;
    return x.toLowerCase();
  }
  literal(): Value {
    const x = this.peek();
    if (x === undefined) throw new Error("Мән күтілді");
    this.i++;
    if (/^'/.test(x)) return x.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d/.test(x)) return Number(x);
    if (x.toUpperCase() === "NULL") return null;
    throw new Error(`Мән күтілді, «${x}» табылды (мәтінді '...' ішіне жаз)`);
  }
  conds(): Cond[] {
    const out: Cond[] = [];
    do {
      const col = this.ident();
      let op = this.peek() as string;
      if (!["=", "!=", "<>", "<", ">", "<=", ">="].includes(op)) throw new Error(`Салыстыру операторы күтілді, «${op ?? "соңы"}» табылды`);
      this.i++;
      if (op === "<>") op = "!=";
      out.push({ col, op: op as Op, value: this.literal() });
    } while (this.kw("AND"));
    return out;
  }
  done() {
    if (this.i < this.t.length) throw new Error(`Артық бөлік: «${this.t.slice(this.i).join(" ")}»`);
  }
}

function test(row: Row, c: Cond): boolean {
  const v = row[c.col];
  if (v === undefined) return false;
  switch (c.op) {
    case "=":
      return v === c.value;
    case "!=":
      return v !== c.value;
    case "<":
      return v !== null && c.value !== null && v < c.value;
    case ">":
      return v !== null && c.value !== null && v > c.value;
    case "<=":
      return v !== null && c.value !== null && v <= c.value;
    case ">=":
      return v !== null && c.value !== null && v >= c.value;
  }
}

/** Rows matching all conditions. Equality on an indexed column jumps straight to matches. */
function find(table: Table, conds: Cond[]): { idx: number[]; scanned: number; usedIndex: string | null } {
  for (const c of conds) if (!table.columns.includes(c.col)) throw new Error(`«${table.name}» кестесінде «${c.col}» бағаны жоқ`);
  const eq = conds.find((c) => c.op === "=" && table.indexed.includes(c.col));
  const candidates = eq
    ? table.rows.flatMap((r, i) => (r[eq.col] === eq.value ? [i] : []))
    : table.rows.map((_, i) => i);
  const idx = candidates.filter((i) => conds.every((c) => test(table.rows[i]!, c)));
  // An index lookup costs ~log2(n) steps plus the matching rows; a scan reads every row.
  const scanned = eq ? Math.ceil(Math.log2(table.rows.length + 1)) + candidates.length : table.rows.length;
  return { idx, scanned, usedIndex: eq ? eq.col : null };
}

/** Run one statement. Returns the new database (never mutates the input) and the result. */
export function execute(db: Db, sql: string): { db: Db; result: QueryResult } {
  let tokens: string[];
  try {
    tokens = tokenize(sql);
  } catch (e) {
    return { db, result: fail((e as Error).message) };
  }
  if (tokens.length === 0) return { db, result: fail("Бос сұрау") };
  const p = new Parser(tokens);
  try {
    const table = (name: string) => {
      const t = db[name];
      if (!t) throw new Error(`«${name}» кестесі жоқ. Бар кестелер: ${Object.keys(db).join(", ")}`);
      return t;
    };

    if (p.kw("SELECT")) {
      let cols: string[] | "*" = "*";
      if (p.peek() === "*") p.i++;
      else {
        cols = [p.ident()];
        while (p.peek() === ",") {
          p.i++;
          cols.push(p.ident());
        }
      }
      p.expectKw("FROM");
      const t = table(p.ident());
      const conds = p.kw("WHERE") ? p.conds() : [];
      let order: { col: string; desc: boolean } | undefined;
      if (p.kw("ORDER")) {
        p.expectKw("BY");
        order = { col: p.ident(), desc: false };
        if (p.kw("DESC")) order.desc = true;
        else p.kw("ASC");
      }
      let limit = Infinity;
      if (p.kw("LIMIT")) {
        const n = p.literal();
        if (typeof n !== "number" || n < 0) throw new Error("LIMIT оң сан болуы керек");
        limit = n;
      }
      p.done();
      const columns = cols === "*" ? t.columns : cols;
      for (const c of columns) if (!t.columns.includes(c)) throw new Error(`«${t.name}» кестесінде «${c}» бағаны жоқ`);
      if (order && !t.columns.includes(order.col)) throw new Error(`«${order.col}» бағаны жоқ`);
      const { idx, scanned, usedIndex } = find(t, conds);
      let picked = idx.map((i) => t.rows[i]!);
      if (order) {
        const { col, desc } = order;
        picked = [...picked].sort((a, b) => {
          const x = a[col] ?? "";
          const y = b[col] ?? "";
          return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
        });
      }
      const rows = picked.slice(0, limit).map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
      return { db, result: { ok: true, kind: "select", rows, columns, affected: 0, scanned, usedIndex, touched: idx } };
    }

    if (p.kw("INSERT")) {
      p.expectKw("INTO");
      const t = table(p.ident());
      p.expect("(");
      const cols = [p.ident()];
      while (p.peek() === ",") {
        p.i++;
        cols.push(p.ident());
      }
      p.expect(")");
      p.expectKw("VALUES");
      p.expect("(");
      const vals = [p.literal()];
      while (p.peek() === ",") {
        p.i++;
        vals.push(p.literal());
      }
      p.expect(")");
      p.done();
      if (cols.length !== vals.length) throw new Error(`Бағандар саны (${cols.length}) мен мәндер саны (${vals.length}) сәйкес емес`);
      for (const c of cols) if (!t.columns.includes(c)) throw new Error(`«${t.name}» кестесінде «${c}» бағаны жоқ`);
      const row: Row = Object.fromEntries(t.columns.map((c) => [c, null]));
      cols.forEach((c, i) => (row[c] = vals[i]!));
      if (t.columns.includes("id") && row.id === null) row.id = t.rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
      const next = { ...t, rows: [...t.rows, row] };
      return { db: { ...db, [t.name]: next }, result: { ok: true, kind: "insert", rows: [], columns: [], affected: 1, scanned: 0, usedIndex: null, touched: [t.rows.length] } };
    }

    if (p.kw("UPDATE")) {
      const t = table(p.ident());
      p.expectKw("SET");
      const sets: [string, Value][] = [];
      do {
        const c = p.ident();
        p.expect("=");
        sets.push([c, p.literal()]);
      } while (p.peek() === "," && p.i++ >= 0);
      const conds = p.kw("WHERE") ? p.conds() : [];
      p.done();
      for (const [c] of sets) if (!t.columns.includes(c)) throw new Error(`«${t.name}» кестесінде «${c}» бағаны жоқ`);
      const { idx, scanned, usedIndex } = find(t, conds);
      const hit = new Set(idx);
      const rows = t.rows.map((r, i) => (hit.has(i) ? { ...r, ...Object.fromEntries(sets) } : r));
      return { db: { ...db, [t.name]: { ...t, rows } }, result: { ok: true, kind: "update", rows: [], columns: [], affected: idx.length, scanned, usedIndex, touched: idx } };
    }

    if (p.kw("DELETE")) {
      p.expectKw("FROM");
      const t = table(p.ident());
      const conds = p.kw("WHERE") ? p.conds() : [];
      p.done();
      const { idx, scanned, usedIndex } = find(t, conds);
      const hit = new Set(idx);
      const rows = t.rows.filter((_, i) => !hit.has(i));
      return { db: { ...db, [t.name]: { ...t, rows } }, result: { ok: true, kind: "delete", rows: [], columns: [], affected: idx.length, scanned, usedIndex, touched: idx } };
    }

    if (p.kw("CREATE")) {
      p.expectKw("INDEX");
      p.expectKw("ON");
      const t = table(p.ident());
      p.expect("(");
      const col = p.ident();
      p.expect(")");
      p.done();
      if (!t.columns.includes(col)) throw new Error(`«${t.name}» кестесінде «${col}» бағаны жоқ`);
      const indexed = t.indexed.includes(col) ? t.indexed : [...t.indexed, col];
      return { db: { ...db, [t.name]: { ...t, indexed } }, result: { ok: true, kind: "index", rows: [], columns: [], affected: 0, scanned: t.rows.length, usedIndex: col, touched: [] } };
    }

    throw new Error(`Белгісіз команда «${tokens[0]}». Қолдау бар: SELECT, INSERT, UPDATE, DELETE, CREATE INDEX`);
  } catch (e) {
    return { db, result: fail((e as Error).message) };
  }
}

/** Substitute :name placeholders with literal values (numbers raw, strings quoted). */
export function bindParams(sql: string, params: Record<string, string>): string {
  return sql.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (m, name: string) => {
    const v = params[name];
    if (v === undefined) return m;
    return /^-?\d+(\.\d+)?$/.test(v) ? v : `'${v.replace(/'/g, "''")}'`;
  });
}
