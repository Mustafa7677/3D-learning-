/**
 * A model of the browser event loop. A program is a list of top-level
 * operations; scheduling ops create tasks (setTimeout, fetch) or microtasks
 * (Promise.then). Running it produces the exact sequence of frames a browser
 * goes through: call stack, Web APIs, microtask queue, task queue, console.
 */
export type Op =
  | { kind: "log"; text: string }
  | { kind: "timeout"; delay: number; body: Op[] }
  | { kind: "promise"; body: Op[] }
  | { kind: "fetch"; url: string; latency: number; body: Op[] };

export interface Program {
  id: string;
  title: string;
  /** JavaScript shown to the learner. */
  source: string;
  ops: Op[];
}

export interface Frame {
  /** What happened at this step, in plain words. */
  note: string;
  stack: string[];
  webApis: string[];
  microtasks: string[];
  tasks: string[];
  output: string[];
  time: number;
}

interface Pending {
  label: string;
  readyAt: number;
  seq: number;
  body: Op[];
}

function label(op: Op): string {
  switch (op.kind) {
    case "log":
      return `console.log("${op.text}")`;
    case "timeout":
      return `setTimeout(…, ${op.delay})`;
    case "promise":
      return "Promise.then(…)";
    case "fetch":
      return `fetch("${op.url}")`;
  }
}

/** Simulate the whole program and return every intermediate frame. */
export function runEventLoop(program: Program): Frame[] {
  const frames: Frame[] = [];
  const output: string[] = [];
  const micro: { label: string; body: Op[] }[] = [];
  const apis: Pending[] = [];
  const tasks: { label: string; body: Op[] }[] = [];
  let time = 0;
  let seq = 0;
  const stack: string[] = [];

  const snap = (note: string) =>
    frames.push({
      note,
      stack: [...stack],
      webApis: apis.map((a) => `${a.label} (${a.readyAt} ms)`),
      microtasks: micro.map((m) => m.label),
      tasks: tasks.map((t) => t.label),
      output: [...output],
      time,
    });

  const exec = (ops: Op[]) => {
    for (const op of ops) {
      stack.push(label(op));
      switch (op.kind) {
        case "log":
          output.push(op.text);
          snap(`«${op.text}» консольге шықты`);
          break;
        case "timeout":
          apis.push({ label: "setTimeout", readyAt: time + op.delay, seq: seq++, body: op.body });
          snap(`Таймер Web API-ге берілді (${op.delay} мс)`);
          break;
        case "promise":
          micro.push({ label: "then-callback", body: op.body });
          snap("Promise дайын: callback microtask кезегіне түсті");
          break;
        case "fetch":
          apis.push({ label: `fetch ${op.url}`, readyAt: time + op.latency, seq: seq++, body: op.body });
          snap(`Сұрау желіге кетті (${op.latency} мс)`);
          break;
      }
      stack.pop();
    }
  };

  stack.push("main()");
  snap("Скрипт басталды: main() стекке түсті");
  exec(program.ops);
  stack.pop();
  snap("Скрипт аяқталды: стек бос");

  let guard = 0;
  while ((micro.length || apis.length || tasks.length) && guard++ < 200) {
    if (micro.length) {
      const m = micro.shift()!;
      stack.push(m.label);
      snap("Стек бос → алдымен БАРЛЫҚ microtask орындалады");
      exec(m.body);
      stack.pop();
      continue;
    }
    if (tasks.length) {
      const t = tasks.shift()!;
      stack.push(t.label);
      snap("Microtask-тар бітті → task кезегінен біреуі алынды");
      exec(t.body);
      stack.pop();
      continue;
    }
    // Advance the clock to the next Web API completion; it becomes a task.
    apis.sort((a, b) => a.readyAt - b.readyAt || a.seq - b.seq);
    const next = apis.shift()!;
    time = Math.max(time, next.readyAt);
    tasks.push({ label: `${next.label} callback`, body: next.body });
    snap(`${time} мс: ${next.label} дайын → callback task кезегіне түсті`);
  }
  snap("Бәрі орындалды");
  return frames;
}

export function finalOutput(program: Program): string[] {
  const f = runEventLoop(program);
  return f[f.length - 1]!.output;
}

export const PROGRAMS: Program[] = [
  {
    id: "basic",
    title: "setTimeout(0) vs Promise",
    source: `console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");`,
    ops: [
      { kind: "log", text: "A" },
      { kind: "timeout", delay: 0, body: [{ kind: "log", text: "B" }] },
      { kind: "promise", body: [{ kind: "log", text: "C" }] },
      { kind: "log", text: "D" },
    ],
  },
  {
    id: "timers",
    title: "Екі таймер",
    source: `setTimeout(() => console.log("1"), 100);
setTimeout(() => console.log("2"), 10);
console.log("3");`,
    ops: [
      { kind: "timeout", delay: 100, body: [{ kind: "log", text: "1" }] },
      { kind: "timeout", delay: 10, body: [{ kind: "log", text: "2" }] },
      { kind: "log", text: "3" },
    ],
  },
  {
    id: "fetch",
    title: "fetch және Promise",
    source: `console.log("бастау");
fetch("/api/user").then(() => {
  console.log("жауап келді");
  Promise.resolve().then(() => console.log("өңделді"));
});
setTimeout(() => console.log("таймер"), 0);
console.log("соңы");`,
    ops: [
      { kind: "log", text: "бастау" },
      {
        kind: "fetch",
        url: "/api/user",
        latency: 120,
        body: [
          { kind: "log", text: "жауап келді" },
          { kind: "promise", body: [{ kind: "log", text: "өңделді" }] },
        ],
      },
      { kind: "timeout", delay: 0, body: [{ kind: "log", text: "таймер" }] },
      { kind: "log", text: "соңы" },
    ],
  },
];
