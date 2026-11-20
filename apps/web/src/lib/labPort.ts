import { exposeRuntime, type MessagePortLike, type SimulationPlugin } from "@inside-tech/sim-core";
import { aiLabPlugin, langLabPlugin } from "@inside-tech/lab-ai";
import { spawnWorker } from "./spawnWorker";

export const LAB_SEED = 20261120;

export type LabKind = "classifier" | "language";

export interface LabPort {
  port: MessagePortLike;
  dispose(): void;
}

/** Runtime on the main thread behind a MessageChannel: same protocol as a worker. */
function inThread<S, A>(plugin: SimulationPlugin<S, A>): LabPort {
  const ch = new MessageChannel();
  exposeRuntime(ch.port2 as unknown as MessagePortLike, plugin, LAB_SEED, { frameMs: 16 });
  ch.port1.start();
  ch.port2.start();
  return {
    port: ch.port1 as unknown as MessagePortLike,
    dispose: () => {
      // Stop the main-thread loop, then release the ports.
      ch.port1.postMessage({ type: "pause", seq: 0 });
      setTimeout(() => {
        ch.port1.close();
        ch.port2.close();
      }, 50);
    },
  };
}

/**
 * A message port to a lab runtime. The classifier lab trains networks, so it
 * runs in a Web Worker when one can start; the language lab is light and runs
 * on the main thread.
 */
export function createLabPort(kind: LabKind): LabPort {
  if (kind === "language") return inThread(langLabPlugin);
  try {
    const worker = spawnWorker();
    return { port: worker as unknown as MessagePortLike, dispose: () => worker.terminate() };
  } catch {
    return inThread(aiLabPlugin);
  }
}
