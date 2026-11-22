import { exposeRuntime, type MessagePortLike, type SimulationPlugin } from "@inside-tech/sim-core";
import { aiLabPlugin, langLabPlugin, optimLabPlugin } from "@inside-tech/lab-ai";
import { webLabPlugin } from "@inside-tech/lab-web";
import { gameLabPlugin } from "@inside-tech/lab-game";
import { algoLabPlugin } from "@inside-tech/lab-algo";
import { archLabPlugin } from "@inside-tech/lab-arch";
import { secLabPlugin } from "@inside-tech/lab-sec";
import { dbLabPlugin } from "@inside-tech/lab-db";
import { netLabPlugin } from "@inside-tech/lab-net";
import { cloudLabPlugin } from "@inside-tech/lab-cloud";
import { iotLabPlugin } from "@inside-tech/lab-iot";
import { mathLabPlugin } from "@inside-tech/lab-math";
import { spawnWorker } from "./spawnWorker";

export const LAB_SEED = 20261120;

export type LabKind = "classifier" | "language" | "optim" | "web" | "game" | "algo" | "arch" | "sec" | "db" | "net" | "cloud" | "iot" | "math";

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

/** The simulation plugin behind a lab kind (for replays on the main thread). */
export function pluginFor(kind: string): SimulationPlugin<unknown, unknown> | undefined {
  const all: Record<string, SimulationPlugin<never, never>> = {
    classifier: aiLabPlugin as never,
    language: langLabPlugin as never,
    optim: optimLabPlugin as never,
    web: webLabPlugin as never,
    game: gameLabPlugin as never,
    algo: algoLabPlugin as never,
    arch: archLabPlugin as never,
    sec: secLabPlugin as never,
    db: dbLabPlugin as never,
    net: netLabPlugin as never,
    cloud: cloudLabPlugin as never,
    iot: iotLabPlugin as never,
    math: mathLabPlugin as never,
  };
  return all[kind] as SimulationPlugin<unknown, unknown> | undefined;
}

/**
 * A message port to a lab runtime. The classifier lab trains networks, so it
 * runs in a Web Worker when one can start; the language and web labs are light
 * and run on the main thread.
 */
export function createLabPort(kind: LabKind): LabPort {
  if (kind === "language") return inThread(langLabPlugin);
  if (kind === "optim") return inThread(optimLabPlugin);
  if (kind === "web") return inThread(webLabPlugin);
  if (kind === "game") return inThread(gameLabPlugin);
  if (kind === "algo") return inThread(algoLabPlugin);
  if (kind === "arch") return inThread(archLabPlugin);
  if (kind === "sec") return inThread(secLabPlugin);
  if (kind === "db") return inThread(dbLabPlugin);
  if (kind === "net") return inThread(netLabPlugin);
  if (kind === "cloud") return inThread(cloudLabPlugin);
  if (kind === "iot") return inThread(iotLabPlugin);
  if (kind === "math") return inThread(mathLabPlugin);
  try {
    const worker = spawnWorker();
    return { port: worker as unknown as MessagePortLike, dispose: () => worker.terminate() };
  } catch {
    return inThread(aiLabPlugin);
  }
}
