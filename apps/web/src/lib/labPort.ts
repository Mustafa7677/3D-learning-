import { exposeRuntime, type MessagePortLike } from "@inside-tech/sim-core";
import { aiLabPlugin } from "@inside-tech/lab-ai";
import { spawnWorker } from "./spawnWorker";

export const LAB_SEED = 20261120;

export interface LabPort {
  port: MessagePortLike;
  dispose(): void;
}

/**
 * A message port to an AI-lab runtime: in a Web Worker when the environment
 * allows one, otherwise on the main thread behind a MessageChannel so the
 * rest of the app is unchanged.
 */
export function createLabPort(): LabPort {
  try {
    const worker = spawnWorker();
    return { port: worker as unknown as MessagePortLike, dispose: () => worker.terminate() };
  } catch {
    const ch = new MessageChannel();
    exposeRuntime(ch.port2 as unknown as MessagePortLike, aiLabPlugin, LAB_SEED, { frameMs: 16 });
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
}
