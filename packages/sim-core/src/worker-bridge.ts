import { SimulationRuntime, type Recording, type RuntimeOptions } from "./runtime";
import type { AssessmentResult, SimulationPlugin } from "./types";

/** Messages main thread → worker. */
export type HostMessage<Action> =
  | { type: "dispatch"; action: Action }
  | { type: "play" }
  | { type: "pause" }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "record"; requestId: number };

/** Messages worker → main thread. */
export type WorkerMessage<State, Action> =
  | { type: "state"; state: State; tick: number; canUndo: boolean; playing: boolean; assessment: AssessmentResult }
  | { type: "recording"; requestId: number; recording: Recording<Action> };

export interface MessagePortLike {
  postMessage(msg: unknown): void;
  addEventListener(type: "message", fn: (ev: { data: unknown }) => void): void;
  removeEventListener?(type: "message", fn: (ev: { data: unknown }) => void): void;
}

/**
 * Worker side: host a runtime and stream state to the main thread.
 * Heavy compute (e.g. neural-network training) then never blocks rendering.
 */
export function exposeRuntime<State, Action>(
  port: MessagePortLike,
  plugin: SimulationPlugin<State, Action>,
  seed: number,
  opts: RuntimeOptions & { frameMs?: number } = {},
): SimulationRuntime<State, Action> {
  const runtime = new SimulationRuntime(plugin, seed, opts);
  const frameMs = opts.frameMs ?? 16;
  let playing = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = 0;
  let dirty = true;

  const post = () => {
    const msg: WorkerMessage<State, Action> = {
      type: "state",
      state: runtime.getState(),
      tick: runtime.getTick(),
      canUndo: runtime.canUndo(),
      playing,
      assessment: runtime.plugin.evaluate(runtime.getState()),
    };
    port.postMessage(msg);
    dirty = false;
  };
  runtime.bus.on("state", () => {
    dirty = true;
  });

  const loop = () => {
    const now = performance.now();
    runtime.advance((now - last) / 1000);
    last = now;
    if (dirty) post();
  };

  port.addEventListener("message", (ev) => {
    const msg = ev.data as HostMessage<Action>;
    switch (msg.type) {
      case "dispatch":
        runtime.dispatch(msg.action);
        break;
      case "play":
        if (!playing) {
          playing = true;
          last = performance.now();
          timer = setInterval(loop, frameMs);
        }
        dirty = true;
        break;
      case "pause":
        playing = false;
        if (timer) clearInterval(timer);
        dirty = true;
        break;
      case "undo":
        runtime.undo();
        break;
      case "reset":
        runtime.reset();
        break;
      case "record":
        port.postMessage({ type: "recording", requestId: msg.requestId, recording: runtime.record() });
        return;
    }
    if (dirty) post();
  });
  post();
  return runtime;
}

export interface RemoteSnapshot<State> {
  state: State;
  tick: number;
  canUndo: boolean;
  playing: boolean;
  assessment: AssessmentResult;
}

/** Main-thread proxy for a runtime living in a worker. */
export class RemoteRuntime<State, Action> {
  private listeners = new Set<(s: RemoteSnapshot<State>) => void>();
  private latest: RemoteSnapshot<State> | undefined;
  private pending = new Map<number, (r: Recording<Action>) => void>();
  private nextId = 1;
  private readonly onMessage = (ev: { data: unknown }) => {
    const msg = ev.data as WorkerMessage<State, Action>;
    if (msg.type === "state") {
      const { type: _t, ...snap } = msg;
      this.latest = snap;
      for (const fn of this.listeners) fn(snap);
    } else if (msg.type === "recording") {
      this.pending.get(msg.requestId)?.(msg.recording);
      this.pending.delete(msg.requestId);
    }
  };

  constructor(private readonly port: MessagePortLike) {
    port.addEventListener("message", this.onMessage);
  }

  get snapshot(): RemoteSnapshot<State> | undefined {
    return this.latest;
  }

  subscribe(fn: (s: RemoteSnapshot<State>) => void): () => void {
    this.listeners.add(fn);
    if (this.latest) fn(this.latest);
    return () => this.listeners.delete(fn);
  }

  dispatch(action: Action): void {
    this.send({ type: "dispatch", action });
  }
  play(): void {
    this.send({ type: "play" });
  }
  pause(): void {
    this.send({ type: "pause" });
  }
  undo(): void {
    this.send({ type: "undo" });
  }
  reset(): void {
    this.send({ type: "reset" });
  }
  record(): Promise<Recording<Action>> {
    const requestId = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.send({ type: "record", requestId });
    });
  }
  dispose(): void {
    this.port.removeEventListener?.("message", this.onMessage);
    this.listeners.clear();
  }

  private send(msg: HostMessage<Action>): void {
    this.port.postMessage(msg);
  }
}
