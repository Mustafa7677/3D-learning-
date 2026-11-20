import { Fragment, type ReactNode } from "react";
import styles from "./prose.module.css";

/**
 * Renders lesson text in a small Markdown subset — headings ("## "),
 * bullet and numbered lists, ``` code blocks, "> " callouts, **bold** and
 * `code`. Builds React elements only (never raw HTML), so authored or
 * imported lessons cannot inject markup.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**") ? <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong> : <code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[]; start: number }
  | { kind: "code"; text: string }
  | { kind: "note"; text: string; tone: "warn" | "idea" | "info" };

function parse(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i]!);
      blocks.push({ kind: "code", text: code.join("\n") });
    } else if (/^##+ /.test(line)) {
      flush();
      blocks.push({ kind: "h", text: line.replace(/^##+ /, "") });
    } else if (/^[-•] /.test(line) || /^\d+\. /.test(line)) {
      flush();
      const ordered = /^\d+\. /.test(line);
      // Keep authored numbering when a list continues after a code block.
      const start = ordered ? Number(/^(\d+)\./.exec(line)![1]) : 1;
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]!) : /^[-•] /.test(lines[i]!))) items.push(lines[i++]!.replace(/^([-•]|\d+\.) /, ""));
      i--;
      blocks.push({ kind: ordered ? "ol" : "ul", items, start });
    } else if (line.startsWith("> ")) {
      flush();
      const parts: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) parts.push(lines[i++]!.slice(2));
      i--;
      const text = parts.join(" ");
      const tone = /^⚠|^Жиі қате|^Абай/.test(text) ? "warn" : /^💡|^Түйін|^Идея/.test(text) ? "idea" : "info";
      blocks.push({ kind: "note", text, tone });
    } else if (!line.trim()) {
      flush();
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function renderBlock(b: Block, k: string): ReactNode {
  switch (b.kind) {
    case "h":
      return <h3 key={k}>{inline(b.text, k)}</h3>;
    case "p":
      return <p key={k}>{inline(b.text, k)}</p>;
    case "ul":
      return (
        <ul key={k}>
          {b.items.map((it, j) => (
            <li key={j}>{inline(it, `${k}-${j}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={k} start={b.start}>
          {b.items.map((it, j) => (
            <li key={j}>{inline(it, `${k}-${j}`)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre key={k}>
          <code>{b.text}</code>
        </pre>
      );
    case "note":
      return (
        <aside key={k} className={styles.note} data-tone={b.tone}>
          <Fragment>{inline(b.text, k)}</Fragment>
        </aside>
      );
  }
}

/** A heading that starts with this word opens an optional, collapsible deep dive. */
const DEEP = /^Тереңірек/;

export function Prose({ text }: { text: string }) {
  const blocks = parse(text);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === "h" && DEEP.test(b.text)) {
      const inner: ReactNode[] = [];
      let j = i + 1;
      for (; j < blocks.length && blocks[j]!.kind !== "h"; j++) inner.push(renderBlock(blocks[j]!, `d${i}-${j}`));
      out.push(
        <details key={`d${i}`} className={styles.deep}>
          <summary>{inline(b.text, `s${i}`)}</summary>
          <div className={styles.deepBody}>{inner}</div>
        </details>,
      );
      i = j - 1;
    } else out.push(renderBlock(b, `b${i}`));
  }
  return <div className={styles.prose}>{out}</div>;
}
