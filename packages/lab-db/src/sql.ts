/**
 * A small relational engine for teaching: a recursive-descent SQL parser and
 * an executor with joins, grouping, indexes, constraints, transactions and
 * EXPLAIN. Every query reports how many table rows it examined, so the cost
 * of a plan is visible, not just its result.
 */
export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Column {
  name: string;
  primaryKey?: boolean;
  notNull?: boolean;
  /** Foreign key: "table.column". */
  references?: string;
}

export interface Table {
  name: string;
  columns: Column[];
  rows: Row[];
  /** Indexed columns. The primary key is always indexed. */
  indexes: string[];
}

export type Db = Record<string, Table>;

export interface Plan {
  table: string;
  access: "scan" | "index";
  column?: string;
  rows: number;
  /** The planner's estimate: a sequential read costs 1, a random jump through an index RANDOM_READ. */
  cost?: number;
  /** An index that existed but would have cost more than reading the whole table. */
  skipped?: string;
}

/** One random read through an index costs about this many sequential reads. */
export const RANDOM_READ = 4;

export interface Result {
  ok: boolean;
  error?: string;
  kind?: "select" | "insert" | "update" | "delete" | "index" | "begin" | "commit" | "rollback" | "explain";
  columns: string[];
  rows: Row[];
  affected: number;
  /** Base-table rows read to answer the query. */
  examined: number;
  plan: Plan[];
}

// ---------------- tokenizer ----------------

type Tok = { t: "num"; v: number } | { t: "str"; v: string } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "-" && src[i + 1] === "-") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
    } else if (ch === "'") {
      let j = i + 1;
      let s = "";
      for (;;) {
        if (j >= src.length) throw new Error("Тырнақша жабылмаған");
        if (src[j] === "'" && src[j + 1] === "'") {
          s += "'";
          j += 2;
        } else if (src[j] === "'") break;
        else s += src[j++];
      }
      out.push({ t: "str", v: s });
      i = j + 1;
    } else if (/[\p{L}_]/u.test(ch)) {
      let j = i;
      while (j < src.length && /[\p{L}\p{N}_]/u.test(src[j]!)) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
    } else {
      const two = src.slice(i, i + 2);
      if (["<=", ">=", "<>", "!="].includes(two)) {
        out.push({ t: "op", v: two });
        i += 2;
      } else if ("=<>(),.*+-/;".includes(ch)) {
        out.push({ t: "op", v: ch });
        i++;
      } else throw new Error(`Түсініксіз таңба: ${ch}`);
    }
  }
  return out;
}

// ---------------- AST ----------------

export type Expr =
  | { k: "lit"; v: Value }
  | { k: "col"; table?: string; name: string }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "not"; e: Expr }
  | { k: "isnull"; e: Expr; neg: boolean }
  | { k: "agg"; fn: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"; arg: Expr | "*" }
  /** x IN (1, 2) or x IN (SELECT ...); NOT IN with neg. */
  | { k: "in"; e: Expr; list?: Expr[]; sub?: Select; neg: boolean }
  /** LIKE with % (any run) and _ (one character). */
  | { k: "like"; e: Expr; pat: Expr; neg: boolean }
  | { k: "between"; e: Expr; lo: Expr; hi: Expr; neg: boolean }
  /** A subquery that returns one value: (SELECT AVG(grade) FROM enrollments). */
  | { k: "sub"; q: Select };

interface SelectItem {
  expr: Expr | "*";
  alias?: string;
}
interface Source {
  table: string;
  alias: string;
}
interface Join {
  src: Source;
  on: Expr;
  /** LEFT JOIN keeps every row on the left, with NULLs where nothing matched. */
  left?: boolean;
}
export interface Select {
  k: "select";
  distinct?: boolean;
  items: SelectItem[];
  from: Source;
  joins: Join[];
  where?: Expr;
  groupBy: Expr[];
  having?: Expr;
  orderBy: { e: Expr; desc: boolean }[];
  limit?: number;
  /** Rows to skip before LIMIT starts counting (they are still read). */
  offset?: number;
}
type Stmt =
  | Select
  | { k: "insert"; table: string; columns: string[]; values: Expr[][] }
  | { k: "update"; table: string; set: { col: string; e: Expr }[]; where?: Expr }
  | { k: "delete"; table: string; where?: Expr }
  | { k: "index"; table: string; column: string }
  | { k: "begin" | "commit" | "rollback" }
  | { k: "explain"; q: Select };

const KEYWORDS = new Set(["DISTINCT", "LEFT", "OUTER", "IN", "LIKE", "BETWEEN", "SELECT", "FROM", "WHERE", "JOIN", "INNER", "ON", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC", "LIMIT", "OFFSET", "AND", "OR", "NOT", "AS", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "INDEX", "BEGIN", "COMMIT", "ROLLBACK", "EXPLAIN", "NULL", "IS"]);

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) {
    return this.toks[this.i + o];
  }
  kw(w: string) {
    const t = this.peek();
    if (t?.t === "id" && t.v.toUpperCase() === w) {
      this.i++;
      return true;
    }
    return false;
  }
  need(w: string) {
    if (!this.kw(w)) throw new Error(`${w} күтілді`);
  }
  op(o: string) {
    const t = this.peek();
    if (t?.t === "op" && t.v === o) {
      this.i++;
      return true;
    }
    return false;
  }
  needOp(o: string) {
    if (!this.op(o)) throw new Error(`«${o}» күтілді`);
  }
  ident(): string {
    const t = this.peek();
    if (t?.t !== "id" || KEYWORDS.has(t.v.toUpperCase())) throw new Error(`Атау күтілді${t ? `, бірақ «${"v" in t ? t.v : ""}» тұр` : ""}`);
    this.i++;
    return t.v.toLowerCase();
  }
  done() {
    this.op(";");
    if (this.i < this.toks.length) {
      const t = this.toks[this.i]!;
      throw new Error(`Артық мәтін: «${String(t.v)}»`);
    }
  }

  statement(): Stmt {
    if (this.kw("SELECT")) return this.select();
    if (this.kw("EXPLAIN")) {
      this.need("SELECT");
      return { k: "explain", q: this.select() };
    }
    if (this.kw("INSERT")) {
      this.need("INTO");
      const table = this.ident();
      this.needOp("(");
      const columns = [this.ident()];
      while (this.op(",")) columns.push(this.ident());
      this.needOp(")");
      this.need("VALUES");
      const values: Expr[][] = [];
      do {
        this.needOp("(");
        const row = [this.expr()];
        while (this.op(",")) row.push(this.expr());
        this.needOp(")");
        values.push(row);
      } while (this.op(","));
      return { k: "insert", table, columns, values };
    }
    if (this.kw("UPDATE")) {
      const table = this.ident();
      this.need("SET");
      const set = [this.assign()];
      while (this.op(",")) set.push(this.assign());
      const where = this.kw("WHERE") ? this.expr() : undefined;
      return { k: "update", table, set, where };
    }
    if (this.kw("DELETE")) {
      this.need("FROM");
      const table = this.ident();
      const where = this.kw("WHERE") ? this.expr() : undefined;
      return { k: "delete", table, where };
    }
    if (this.kw("CREATE")) {
      this.need("INDEX");
      this.need("ON");
      const table = this.ident();
      this.needOp("(");
      const column = this.ident();
      this.needOp(")");
      return { k: "index", table, column };
    }
    if (this.kw("BEGIN")) return { k: "begin" };
    if (this.kw("COMMIT")) return { k: "commit" };
    if (this.kw("ROLLBACK")) return { k: "rollback" };
    throw new Error("SELECT, INSERT, UPDATE, DELETE, CREATE INDEX, BEGIN, COMMIT, ROLLBACK не EXPLAIN күтілді");
  }
  assign() {
    const col = this.ident();
    this.needOp("=");
    return { col, e: this.expr() };
  }
  source(): Source {
    const table = this.ident();
    this.kw("AS");
    const t = this.peek();
    const alias = t?.t === "id" && !KEYWORDS.has(t.v.toUpperCase()) ? this.ident() : table;
    return { table, alias };
  }
  select(): Select {
    const distinct = this.kw("DISTINCT");
    const items: SelectItem[] = [];
    do {
      if (this.op("*")) items.push({ expr: "*" });
      else {
        const expr = this.expr();
        const alias = this.kw("AS") ? this.ident() : undefined;
        items.push({ expr, alias });
      }
    } while (this.op(","));
    this.need("FROM");
    const from = this.source();
    const joins: Join[] = [];
    for (;;) {
      let left = false;
      if (this.kw("LEFT")) {
        this.kw("OUTER");
        left = true;
      } else this.kw("INNER");
      if (!this.kw("JOIN")) {
        if (left) throw new Error("LEFT-тен кейін JOIN күтілді");
        break;
      }
      const src = this.source();
      this.need("ON");
      joins.push({ src, on: this.expr(), left });
    }
    const where = this.kw("WHERE") ? this.expr() : undefined;
    const groupBy: Expr[] = [];
    if (this.kw("GROUP")) {
      this.need("BY");
      do groupBy.push(this.expr());
      while (this.op(","));
    }
    const having = this.kw("HAVING") ? this.expr() : undefined;
    const orderBy: Select["orderBy"] = [];
    if (this.kw("ORDER")) {
      this.need("BY");
      do {
        const e = this.expr();
        const desc = this.kw("DESC") ? true : (this.kw("ASC"), false);
        orderBy.push({ e, desc });
      } while (this.op(","));
    }
    let limit: number | undefined;
    if (this.kw("LIMIT")) {
      const t = this.peek();
      if (t?.t !== "num") throw new Error("LIMIT-тен кейін сан керек");
      this.i++;
      limit = t.v;
    }
    let offset: number | undefined;
    if (limit !== undefined && this.kw("OFFSET")) {
      const t = this.peek();
      if (t?.t !== "num") throw new Error("OFFSET-тен кейін сан керек");
      this.i++;
      offset = t.v;
    }
    return { k: "select", distinct, items, from, joins, where, groupBy, having, orderBy, limit, offset };
  }
  expr(): Expr {
    let a = this.and();
    while (this.kw("OR")) a = { k: "bin", op: "OR", a, b: this.and() };
    return a;
  }
  and(): Expr {
    let a = this.not();
    while (this.kw("AND")) a = { k: "bin", op: "AND", a, b: this.not() };
    return a;
  }
  not(): Expr {
    if (this.kw("NOT")) return { k: "not", e: this.not() };
    return this.cmp();
  }
  cmp(): Expr {
    const a = this.add();
    // x [NOT] IN / LIKE / BETWEEN
    const save = this.i;
    const neg = this.kw("NOT");
    if (this.kw("IN")) {
      this.needOp("(");
      if (this.kw("SELECT")) {
        const sub = this.select();
        this.needOp(")");
        return { k: "in", e: a, sub, neg };
      }
      const list = [this.expr()];
      while (this.op(",")) list.push(this.expr());
      this.needOp(")");
      return { k: "in", e: a, list, neg };
    }
    if (this.kw("LIKE")) return { k: "like", e: a, pat: this.add(), neg };
    if (this.kw("BETWEEN")) {
      const lo = this.add();
      this.need("AND");
      return { k: "between", e: a, lo, hi: this.add(), neg };
    }
    this.i = save;
    if (this.kw("IS")) {
      const neg = this.kw("NOT");
      this.need("NULL");
      return { k: "isnull", e: a, neg };
    }
    const t = this.peek();
    if (t?.t === "op" && ["=", "!=", "<>", "<", ">", "<=", ">="].includes(t.v)) {
      this.i++;
      return { k: "bin", op: t.v === "<>" ? "!=" : t.v, a, b: this.add() };
    }
    return a;
  }
  add(): Expr {
    let a = this.mul();
    for (;;) {
      if (this.op("+")) a = { k: "bin", op: "+", a, b: this.mul() };
      else if (this.op("-")) a = { k: "bin", op: "-", a, b: this.mul() };
      else return a;
    }
  }
  mul(): Expr {
    let a = this.atom();
    for (;;) {
      if (this.op("*")) a = { k: "bin", op: "*", a, b: this.atom() };
      else if (this.op("/")) a = { k: "bin", op: "/", a, b: this.atom() };
      else return a;
    }
  }
  atom(): Expr {
    const t = this.peek();
    if (!t) throw new Error("Сұраныс ерте аяқталды");
    if (this.op("(")) {
      if (this.kw("SELECT")) {
        const q = this.select();
        this.needOp(")");
        return { k: "sub", q };
      }
      const e = this.expr();
      this.needOp(")");
      return e;
    }
    if (this.op("-")) {
      const e = this.atom();
      return { k: "bin", op: "-", a: { k: "lit", v: 0 }, b: e };
    }
    if (t.t === "num") {
      this.i++;
      return { k: "lit", v: t.v };
    }
    if (t.t === "str") {
      this.i++;
      return { k: "lit", v: t.v };
    }
    if (t.t === "id") {
      const up = t.v.toUpperCase();
      if (up === "NULL") {
        this.i++;
        return { k: "lit", v: null };
      }
      if (["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(up) && this.peek(1)?.t === "op" && (this.peek(1) as { v: string }).v === "(") {
        this.i += 2;
        const arg: Expr | "*" = this.op("*") ? "*" : this.expr();
        this.needOp(")");
        return { k: "agg", fn: up as "COUNT", arg };
      }
      const first = this.ident();
      if (this.op(".")) return { k: "col", table: first, name: this.ident() };
      return { k: "col", name: first };
    }
    throw new Error(`Күтпеген «${String(t.v)}»`);
  }
}

export function parse(sql: string): Stmt {
  const p = new Parser(tokenize(sql));
  const s = p.statement();
  p.done();
  return s;
}

// ---------------- evaluation ----------------

/** A row during a query: values keyed both "alias.col" and "col". */
type Ctx = Record<string, Value>;

function colValue(ctx: Ctx, e: { table?: string; name: string }): Value {
  if (!e.table && ctx[`\u0000ambiguous:${e.name}`]) throw new Error(`«${e.name}» бірнеше кестеде бар: кесте атын жаз (мысалы s.${e.name})`);
  const key = e.table ? `${e.table}.${e.name}` : e.name;
  if (!(key in ctx)) throw new Error(`«${key}» бағаны жоқ${e.table ? "" : " (не екі кестеде де бар: кесте атын жаз)"}`);
  return ctx[key]!;
}

function cmp(a: Value, b: Value): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "kk");
}

function evalExpr(e: Expr, ctx: Ctx, group?: Ctx[]): Value {
  switch (e.k) {
    case "lit":
      return e.v;
    case "col":
      return colValue(ctx, e);
    case "not": {
      const v = evalExpr(e.e, ctx, group);
      return v === null ? null : v ? 0 : 1;
    }
    case "isnull": {
      const v = evalExpr(e.e, ctx, group);
      return (v === null) !== e.neg ? 1 : 0;
    }
    case "in": {
      const v = evalExpr(e.e, ctx, group);
      if (!e.list) throw new Error("Ішкі сұраныс әлі есептелмеді");
      if (v === null) return null;
      const vals = e.list.map((x) => evalExpr(x, ctx, group));
      const hit = vals.some((x) => x !== null && cmp(v, x) === 0);
      // SQL: NOT IN with a NULL in the list is unknown, never true.
      if (!hit && vals.includes(null)) return null;
      return hit !== e.neg ? 1 : 0;
    }
    case "like": {
      const v = evalExpr(e.e, ctx, group);
      const p = evalExpr(e.pat, ctx, group);
      if (v === null || p === null) return null;
      const re = new RegExp(`^${String(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "su");
      return re.test(String(v)) !== e.neg ? 1 : 0;
    }
    case "between": {
      const v = evalExpr(e.e, ctx, group);
      const lo = evalExpr(e.lo, ctx, group);
      const hi = evalExpr(e.hi, ctx, group);
      if (v === null || lo === null || hi === null) return null;
      return (cmp(v, lo) >= 0 && cmp(v, hi) <= 0) !== e.neg ? 1 : 0;
    }
    case "sub":
      throw new Error("Ішкі сұраныс әлі есептелмеді");
    case "agg": {
      const rows = group ?? [ctx];
      const vals = e.arg === "*" ? rows.map(() => 1) : rows.map((r) => evalExpr(e.arg as Expr, r)).filter((v) => v !== null);
      if (e.fn === "COUNT") return vals.length;
      if (!vals.length) return null;
      const nums = vals.map(Number);
      if (e.fn === "SUM") return nums.reduce((s, x) => s + x, 0);
      if (e.fn === "AVG") return Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100;
      const sorted = [...vals].sort(cmp);
      return e.fn === "MIN" ? sorted[0]! : sorted[sorted.length - 1]!;
    }
    case "bin": {
      if (e.op === "AND") return evalExpr(e.a, ctx, group) && evalExpr(e.b, ctx, group) ? 1 : 0;
      if (e.op === "OR") return evalExpr(e.a, ctx, group) || evalExpr(e.b, ctx, group) ? 1 : 0;
      const a = evalExpr(e.a, ctx, group);
      const b = evalExpr(e.b, ctx, group);
      if (a === null || b === null) return null; // SQL's three-valued logic: comparisons with NULL are unknown
      switch (e.op) {
        case "=":
          return cmp(a, b) === 0 ? 1 : 0;
        case "!=":
          return cmp(a, b) !== 0 ? 1 : 0;
        case "<":
          return cmp(a, b) < 0 ? 1 : 0;
        case ">":
          return cmp(a, b) > 0 ? 1 : 0;
        case "<=":
          return cmp(a, b) <= 0 ? 1 : 0;
        case ">=":
          return cmp(a, b) >= 0 ? 1 : 0;
        case "+":
          return Number(a) + Number(b);
        case "-":
          return Number(a) - Number(b);
        case "*":
          return Number(a) * Number(b);
        case "/":
          if (Number(b) === 0) throw new Error("Нөлге бөлу");
          return Number(a) / Number(b);
      }
      throw new Error(`Белгісіз амал ${e.op}`);
    }
  }
}

const hasAgg = (e: Expr | "*"): boolean =>
  e !== "*" &&
  (e.k === "agg" ||
    (e.k === "bin" && (hasAgg(e.a) || hasAgg(e.b))) ||
    ((e.k === "not" || e.k === "isnull") && hasAgg(e.e)) ||
    ((e.k === "in" || e.k === "like" || e.k === "between") && hasAgg(e.e)));

/**
 * Run uncorrelated subqueries once, before the outer query: a scalar
 * subquery becomes its single value, IN (SELECT ...) becomes a list.
 */
function resolveSubs(db: Db, e: Expr | undefined, examined: { n: number }): Expr | undefined {
  if (!e) return e;
  const r = (x: Expr) => resolveSubs(db, x, examined)!;
  switch (e.k) {
    case "sub": {
      const res = runSelect(db, e.q);
      examined.n += res.examined;
      if (res.columns.length !== 1) throw new Error("Ішкі сұраныс бір баған қайтаруы керек");
      if (res.rows.length > 1) throw new Error("Ішкі сұраныс бір мәннен көп қайтарды");
      return { k: "lit", v: res.rows[0] ? (Object.values(res.rows[0])[0] ?? null) : null };
    }
    case "in": {
      if (e.sub) {
        const res = runSelect(db, e.sub);
        examined.n += res.examined;
        if (res.columns.length !== 1) throw new Error("IN ішіндегі сұраныс бір баған қайтаруы керек");
        return { k: "in", e: r(e.e), list: res.rows.map((row) => ({ k: "lit", v: Object.values(row)[0] ?? null }) as Expr), neg: e.neg };
      }
      return { ...e, e: r(e.e), list: e.list!.map(r) };
    }
    case "bin":
      return { ...e, a: r(e.a), b: r(e.b) };
    case "not":
    case "isnull":
      return { ...e, e: r(e.e) };
    case "like":
      return { ...e, e: r(e.e), pat: r(e.pat) };
    case "between":
      return { ...e, e: r(e.e), lo: r(e.lo), hi: r(e.hi) };
    default:
      return e;
  }
}

function label(e: Expr): string {
  switch (e.k) {
    case "col":
      return e.table ? `${e.table}.${e.name}` : e.name;
    case "lit":
      return String(e.v);
    case "agg":
      return `${e.fn.toLowerCase()}(${e.arg === "*" ? "*" : label(e.arg)})`;
    case "bin":
      return `${label(e.a)} ${e.op.toLowerCase()} ${label(e.b)}`;
    case "not":
      return `not ${label(e.e)}`;
    case "isnull":
      return `${label(e.e)} is ${e.neg ? "not " : ""}null`;
    case "in":
      return `${label(e.e)} ${e.neg ? "not " : ""}in (...)`;
    case "like":
      return `${label(e.e)} ${e.neg ? "not " : ""}like ${label(e.pat)}`;
    case "between":
      return `${label(e.e)} ${e.neg ? "not " : ""}between ${label(e.lo)} and ${label(e.hi)}`;
    case "sub":
      return "(select ...)";
  }
}

function ctxOf(alias: string, row: Row, into: Ctx = {}): Ctx {
  for (const [k, v] of Object.entries(row)) {
    into[`${alias}.${k}`] = v;
    const owner = into[`\u0000owner:${k}`];
    if (owner !== undefined && owner !== alias) into[`\u0000ambiguous:${k}`] = 1;
    else {
      into[k] = v;
      into[`\u0000owner:${k}`] = alias;
    }
  }
  return into;
}

/** If `where` contains `col = literal` (at the top level of ANDs) on an indexed column, use it. */
function indexable(where: Expr | undefined, alias: string, t: Table): { column: string; value: Value } | undefined {
  // Like a real planner: of all usable indexes, the one that matches the fewest rows.
  const all = indexCandidates(where, alias, t);
  const count = (c: { column: string; value: Value }) => t.rows.filter((r) => r[c.column] === c.value).length;
  return all.sort((a, b) => count(a) - count(b))[0];
}

function indexCandidates(where: Expr | undefined, alias: string, t: Table): { column: string; value: Value }[] {
  if (!where) return [];
  if (where.k === "bin" && where.op === "AND") return [...indexCandidates(where.a, alias, t), ...indexCandidates(where.b, alias, t)];
  const one = indexableOne(where, alias, t);
  return one ? [one] : [];
}

function indexableOne(where: Expr, alias: string, t: Table): { column: string; value: Value } | undefined {
  if (where.k === "bin" && where.op === "=") {
    const [c, l] = where.a.k === "col" && where.b.k === "lit" ? [where.a, where.b] : where.b.k === "col" && where.a.k === "lit" ? [where.b, where.a] : [];
    if (c && l && c.k === "col" && l.k === "lit" && (!c.table || c.table === alias) && t.indexes.includes(c.name)) return { column: c.name, value: l.v };
  }
  return undefined;
}

/** `col > lit`-style bounds on `col` at the top level of ANDs: where an index seek can start. */
function seekBound(where: Expr | undefined, alias: string, col: string): ((r: Row) => boolean) | undefined {
  if (!where || where.k !== "bin") return undefined;
  if (where.op === "AND") return seekBound(where.a, alias, col) ?? seekBound(where.b, alias, col);
  if (![">", ">=", "<", "<="].includes(where.op)) return undefined;
  const isCol = (e: Expr) => e.k === "col" && e.name === col && (!e.table || e.table === alias);
  if (isCol(where.a) && where.b.k === "lit") {
    const v = where.b.v;
    const op = where.op;
    return (r) => {
      const d = cmp(r[col] ?? null, v);
      return op === ">" ? d > 0 : op === ">=" ? d >= 0 : op === "<" ? d < 0 : d <= 0;
    };
  }
  return undefined;
}

function runSelect(db: Db, q0: Select): Result {
  const plan: Plan[] = [];
  const sub = { n: 0 };
  const q: Select = {
    ...q0,
    where: resolveSubs(db, q0.where, sub),
    having: resolveSubs(db, q0.having, sub),
    items: q0.items.map((it) => (it.expr === "*" ? it : { ...it, expr: resolveSubs(db, it.expr, sub)! })),
    joins: q0.joins.map((j) => ({ ...j, on: resolveSubs(db, j.on, sub)! })),
  };
  let examined = sub.n;
  const base = db[q.from.table];
  if (!base) throw new Error(`«${q.from.table}» кестесі жоқ`);

  // Access path for the first table.
  const idx = q.joins.length === 0 ? indexable(q.where, q.from.alias, base) : indexable(q.where, q.from.alias, base);
  let baseRows = base.rows;
  // ORDER BY an indexed column with a LIMIT: walk the index in order, seek past a range bound
  // without reading, and stop as soon as OFFSET + LIMIT rows have matched.
  const ord = q.orderBy.length === 1 ? q.orderBy[0]! : undefined;
  const ordCol = ord && ord.e.k === "col" && (!ord.e.table || ord.e.table === q.from.alias) && base.indexes.includes(ord.e.name) ? ord.e.name : undefined;
  const walk = !!ordCol && q.limit !== undefined && q.joins.length === 0 && q.groupBy.length === 0 && !q.having && !q.distinct && !q.items.some((it) => hasAgg(it.expr));
  if (walk && ordCol) {
    const sorted = [...base.rows].sort((x, y) => (ord!.desc ? -1 : 1) * cmp(x[ordCol] ?? null, y[ordCol] ?? null));
    const bound = seekBound(q.where, q.from.alias, ordCol);
    let i = bound ? sorted.findIndex(bound) : 0;
    if (i < 0) i = sorted.length;
    const want = (q.offset ?? 0) + q.limit!;
    const matched: Row[] = [];
    let walked = 0;
    for (; i < sorted.length && matched.length < want; i++) {
      walked++;
      if (!q.where || evalExpr(q.where, ctxOf(q.from.alias, sorted[i]!))) matched.push(sorted[i]!);
    }
    baseRows = matched;
    plan.push({ table: base.name, access: "index", column: ordCol, rows: walked });
    examined += walked;
  } else if (idx && base.rows.filter((r) => r[idx.column] === idx.value).length * RANDOM_READ < base.rows.length) {
    baseRows = base.rows.filter((r) => r[idx.column] === idx.value);
    plan.push({ table: base.name, access: "index", column: idx.column, rows: baseRows.length, cost: baseRows.length * RANDOM_READ });
  } else plan.push({ table: base.name, access: "scan", rows: base.rows.length, cost: base.rows.length, ...(idx ? { skipped: idx.column } : {}) });
  if (!walk) examined += baseRows.length;
  let ctxs: Ctx[] = baseRows.map((r) => ctxOf(q.from.alias, r));

  for (const j of q.joins) {
    const t = db[j.src.table];
    if (!t) throw new Error(`«${j.src.table}» кестесі жоқ`);
    // Index nested-loop join when the ON column of the new table is indexed.
    const on = j.on;
    let probeCol: string | undefined;
    let outer: Expr | undefined;
    if (on.k === "bin" && on.op === "=") {
      for (const [x, y] of [
        [on.a, on.b],
        [on.b, on.a],
      ] as const) {
        if (x.k === "col" && x.table === j.src.alias && t.indexes.includes(x.name)) {
          probeCol = x.name;
          outer = y;
        }
      }
    }
    const next: Ctx[] = [];
    // A LEFT JOIN row that found nothing: the new table's columns are all NULL.
    const nullRow: Row = Object.fromEntries(t.columns.map((c) => [c.name, null]));
    if (probeCol && outer) {
      const byKey = new Map<Value, Row[]>();
      for (const r of t.rows) byKey.set(r[probeCol]!, [...(byKey.get(r[probeCol]!) ?? []), r]);
      let touched = 0;
      for (const c of ctxs) {
        const matches = byKey.get(evalExpr(outer, c)) ?? [];
        touched += matches.length;
        for (const r of matches) next.push(ctxOf(j.src.alias, r, { ...c }));
        if (j.left && matches.length === 0) next.push(ctxOf(j.src.alias, nullRow, { ...c }));
      }
      plan.push({ table: t.name, access: "index", column: probeCol, rows: touched });
      examined += touched;
    } else {
      for (const c of ctxs) {
        let found = false;
        for (const r of t.rows) {
          const merged = ctxOf(j.src.alias, r, { ...c });
          if (evalExpr(j.on, merged)) {
            next.push(merged);
            found = true;
          }
        }
        if (j.left && !found) next.push(ctxOf(j.src.alias, nullRow, { ...c }));
      }
      plan.push({ table: t.name, access: "scan", rows: t.rows.length * ctxs.length });
      examined += t.rows.length * ctxs.length;
    }
    ctxs = next;
  }

  if (q.where) ctxs = ctxs.filter((c) => evalExpr(q.where!, c));

  const aggregate = q.groupBy.length > 0 || q.items.some((it) => hasAgg(it.expr));
  const columns: string[] = [];
  let out: { row: Row; ctx: Ctx; group?: Ctx[] }[] = [];
  if (aggregate) {
    if (q.items.some((it) => it.expr === "*")) throw new Error("GROUP BY-мен * қолдануға болмайды");
    const groups = new Map<string, Ctx[]>();
    for (const c of ctxs) {
      const key = JSON.stringify(q.groupBy.map((g) => evalExpr(g, c)));
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    if (groups.size === 0 && q.groupBy.length === 0) groups.set("[]", []);
    for (const g of groups.values()) {
      if (q.having && !evalExpr(q.having, g[0] ?? {}, g)) continue;
      const row: Row = {};
      for (const it of q.items) {
        const e = it.expr as Expr;
        if (!hasAgg(e) && e.k === "col" && !q.groupBy.some((x) => x.k === "col" && x.name === e.name && (!x.table || !e.table || x.table === e.table))) {
          throw new Error(`«${label(e)}» GROUP BY-да жоқ және агрегат емес`);
        }
        row[it.alias ?? label(e)] = evalExpr(e, g[0] ?? {}, g);
      }
      out.push({ row, ctx: { ...(g[0] ?? {}), ...row }, group: g });
    }
    columns.push(...q.items.map((it) => it.alias ?? label(it.expr as Expr)));
  } else {
    const aliases = [q.from, ...q.joins.map((j) => j.src)];
    for (const it of q.items) {
      if (it.expr === "*") {
        for (const a of aliases) for (const c of db[a.table]!.columns) columns.push(aliases.length > 1 ? `${a.alias}.${c.name}` : c.name);
      } else columns.push(it.alias ?? label(it.expr));
    }
    out = ctxs.map((c) => {
      const row: Row = {};
      for (const it of q.items) {
        if (it.expr === "*") {
          for (const a of aliases) for (const col of db[a.table]!.columns) row[aliases.length > 1 ? `${a.alias}.${col.name}` : col.name] = c[`${a.alias}.${col.name}`] ?? null;
        } else row[it.alias ?? label(it.expr)] = evalExpr(it.expr, c);
      }
      return { row, ctx: { ...c, ...row } };
    });
  }

  if (q.orderBy.length) {
    out.sort((x, y) => {
      for (const o of q.orderBy) {
        const a = evalExpr(o.e, x.ctx, x.group);
        const b = evalExpr(o.e, y.ctx, y.group);
        const d = a === null ? (b === null ? 0 : 1) : b === null ? -1 : cmp(a, b);
        if (d) return o.desc ? -d : d;
      }
      return 0;
    });
  }
  if (q.distinct) {
    const seen = new Set<string>();
    out = out.filter((o) => {
      const k = JSON.stringify(Object.values(o.row));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const skip = q.offset ?? 0;
  const rows = out.map((o) => o.row).slice(skip, q.limit !== undefined ? skip + q.limit : undefined);
  return { ok: true, kind: "select", columns: [...new Set(columns)], rows, affected: 0, examined, plan };
}

function check(db: Db, t: Table, row: Row, skipIndex?: number): void {
  for (const c of t.columns) {
    const v = row[c.name] ?? null;
    if ((c.notNull || c.primaryKey) && v === null) throw new Error(`NOT NULL шектеуі: «${t.name}.${c.name}» бос болмауы керек`);
    if (c.primaryKey && t.rows.some((r, i) => i !== skipIndex && r[c.name] === v)) throw new Error(`PRIMARY KEY шектеуі: «${t.name}.${c.name}» = ${String(v)} бар`);
    if (c.references && v !== null) {
      const [rt, rc] = c.references.split(".") as [string, string];
      if (!db[rt]?.rows.some((r) => r[rc] === v)) throw new Error(`FOREIGN KEY шектеуі: ${rt}.${rc} = ${String(v)} жоқ`);
    }
  }
}

/** Rows elsewhere that point at this row (deleting it would leave them dangling). */
function referencedBy(db: Db, t: Table, row: Row): string | undefined {
  for (const other of Object.values(db))
    for (const c of other.columns) {
      if (!c.references) continue;
      const [rt, rc] = c.references.split(".") as [string, string];
      if (rt === t.name && other.rows.some((r) => r[c.name] === row[rc])) return `${other.name}.${c.name}`;
    }
  return undefined;
}

const clone = (db: Db): Db => Object.fromEntries(Object.entries(db).map(([k, t]) => [k, { ...t, rows: t.rows.map((r) => ({ ...r })), indexes: [...t.indexes] }]));

export interface Session {
  db: Db;
  /** Snapshot taken at BEGIN; ROLLBACK restores it. */
  snapshot: Db | null;
}

const empty = (kind: Result["kind"], extra: Partial<Result> = {}): Result => ({ ok: true, kind, columns: [], rows: [], affected: 0, examined: 0, plan: [], ...extra });

/** Execute one statement. Never mutates the input session. */
export function execute(session: Session, sql: string): { session: Session; result: Result } {
  try {
    const st = parse(sql);
    const db = st.k === "select" || st.k === "explain" ? session.db : clone(session.db);
    const table = (name: string) => {
      const t = db[name];
      if (!t) throw new Error(`«${name}» кестесі жоқ`);
      return t;
    };
    switch (st.k) {
      case "select":
        return { session, result: runSelect(db, st) };
      case "explain": {
        const r = runSelect(db, st.q);
        return { session, result: { ...empty("explain"), plan: r.plan, examined: r.examined, columns: ["кесте", "қол жеткізу", "жолдар", "баға"], rows: r.plan.map((p) => ({ кесте: p.table, "қол жеткізу": p.access === "index" ? `индекс (${p.column})` : p.skipped ? `толық сканерлеу (${p.skipped} индексі тиімсіз)` : "толық сканерлеу", жолдар: p.rows, баға: p.cost ?? p.rows })) } };
      }
      case "insert": {
        const t = table(st.table);
        for (const c of st.columns) if (!t.columns.some((x) => x.name === c)) throw new Error(`«${st.table}.${c}» бағаны жоқ`);
        for (const vals of st.values) {
          if (vals.length !== st.columns.length) throw new Error("Бағандар мен мәндер саны сәйкес емес");
          const row: Row = Object.fromEntries(t.columns.map((c) => [c.name, null]));
          st.columns.forEach((c, i) => (row[c] = evalExpr(vals[i]!, {})));
          check(db, t, row);
          t.rows.push(row);
        }
        return { session: { ...session, db }, result: empty("insert", { affected: st.values.length }) };
      }
      case "update": {
        const t = table(st.table);
        let affected = 0;
        t.rows = t.rows.map((r, i) => {
          const ctx = ctxOf(st.table, r);
          if (st.where && !evalExpr(st.where, ctx)) return r;
          const next = { ...r };
          for (const s of st.set) {
            if (!t.columns.some((c) => c.name === s.col)) throw new Error(`«${st.table}.${s.col}» бағаны жоқ`);
            next[s.col] = evalExpr(s.e, ctx);
          }
          check(db, { ...t, rows: t.rows }, next, i);
          affected++;
          return next;
        });
        return { session: { ...session, db }, result: empty("update", { affected, examined: t.rows.length }) };
      }
      case "delete": {
        const t = table(st.table);
        const keep: Row[] = [];
        let affected = 0;
        for (const r of t.rows) {
          if (st.where && !evalExpr(st.where, ctxOf(st.table, r))) keep.push(r);
          else {
            const ref = referencedBy(db, t, r);
            if (ref) throw new Error(`FOREIGN KEY шектеуі: бұл жолға ${ref} сілтейді`);
            affected++;
          }
        }
        t.rows = keep;
        return { session: { ...session, db }, result: empty("delete", { affected, examined: keep.length + affected }) };
      }
      case "index": {
        const t = table(st.table);
        if (!t.columns.some((c) => c.name === st.column)) throw new Error(`«${st.table}.${st.column}» бағаны жоқ`);
        if (!t.indexes.includes(st.column)) t.indexes.push(st.column);
        return { session: { ...session, db }, result: empty("index") };
      }
      case "begin":
        if (session.snapshot) throw new Error("Транзакция әлдеқашан басталған");
        return { session: { db: session.db, snapshot: session.db }, result: empty("begin") };
      case "commit":
        if (!session.snapshot) throw new Error("Ашық транзакция жоқ");
        return { session: { db: session.db, snapshot: null }, result: empty("commit") };
      case "rollback":
        if (!session.snapshot) throw new Error("Ашық транзакция жоқ");
        return { session: { db: session.snapshot, snapshot: null }, result: empty("rollback") };
    }
  } catch (e) {
    return { session, result: { ok: false, error: (e as Error).message, columns: [], rows: [], affected: 0, examined: 0, plan: [] } };
  }
}
