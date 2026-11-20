/**
 * A small, forgiving HTML parser for the DOM lesson. It builds the same kind
 * of tree a browser does and, unlike a browser, reports every repair it had to
 * make (unclosed tags, stray closing tags), so mistakes become visible.
 */
export interface DomNode {
  id: number;
  type: "element" | "text";
  tag: string;
  attrs: Record<string, string>;
  text: string;
  children: DomNode[];
}

export interface ParseIssue {
  message: string;
  line: number;
}

export interface ParseResult {
  root: DomNode;
  issues: ParseIssue[];
  count: number;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const MAX_NODES = 400;

export function parseHtml(src: string): ParseResult {
  let nextId = 1;
  const root: DomNode = { id: 0, type: "element", tag: "#document", attrs: {}, text: "", children: [] };
  const stack: DomNode[] = [root];
  const issues: ParseIssue[] = [];
  const lineAt = (pos: number) => src.slice(0, pos).split("\n").length;
  const re = /<!--[\s\S]*?-->|<\/\s*([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g;
  let m: RegExpExecArray | null;
  let count = 0;

  while ((m = re.exec(src)) && count < MAX_NODES) {
    const top = stack[stack.length - 1]!;
    const [whole, closeTag, openTag, attrSrc, selfClose] = m;
    if (whole.startsWith("<!--")) continue;
    if (closeTag) {
      const tag = closeTag.toLowerCase();
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at <= 0) {
        issues.push({ message: `</${tag}> артық: мұндай ашық тег жоқ`, line: lineAt(m.index) });
        continue;
      }
      for (let i = stack.length - 1; i > at; i--) issues.push({ message: `<${stack[i]!.tag}> жабылмаған`, line: lineAt(m.index) });
      stack.length = at;
      continue;
    }
    if (openTag) {
      const tag = openTag.toLowerCase();
      const attrs: Record<string, string> = {};
      const ar = /([^\s=>/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(attrSrc ?? ""))) attrs[a[1]!.toLowerCase()] = a[3] ?? a[4] ?? a[5] ?? "";
      const node: DomNode = { id: nextId++, type: "element", tag, attrs, text: "", children: [] };
      count++;
      top.children.push(node);
      if (!VOID.has(tag) && !selfClose) stack.push(node);
      continue;
    }
    if (whole === "<") {
      issues.push({ message: "«<» таңбасы тег емес: мәтінде &lt; деп жаз", line: lineAt(m.index) });
      continue;
    }
    const text = whole.replace(/\s+/g, " ");
    if (text.trim()) {
      top.children.push({ id: nextId++, type: "text", tag: "#text", attrs: {}, text: text.trim(), children: [] });
      count++;
    }
  }
  for (let i = stack.length - 1; i > 0; i--) issues.push({ message: `<${stack[i]!.tag}> жабылмаған`, line: lineAt(src.length) });
  if (count >= MAX_NODES) issues.push({ message: `Тым көп элемент: алғашқы ${MAX_NODES} ғана көрсетілді`, line: 1 });
  return { root, issues, count };
}

export function walk(node: DomNode, fn: (n: DomNode, depth: number) => void, depth = 0): void {
  fn(node, depth);
  for (const c of node.children) walk(c, fn, depth + 1);
}

export function findAll(root: DomNode, tag: string): DomNode[] {
  const out: DomNode[] = [];
  walk(root, (n) => {
    if (n.type === "element" && n.tag === tag) out.push(n);
  });
  return out;
}

export function textContent(n: DomNode): string {
  if (n.type === "text") return n.text;
  return n.children.map(textContent).join(" ").trim();
}

export function depthOf(root: DomNode): number {
  let max = 0;
  walk(root, (_, d) => (max = Math.max(max, d)));
  return max;
}
