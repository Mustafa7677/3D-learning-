/// <reference lib="webworker" />
import { exposeRuntime, type MessagePortLike } from "@inside-tech/sim-core";
import { aiLabPlugin } from "@inside-tech/lab-ai";

/** Fixed seed: every learner starts from the same world, so sessions are replayable. */
const SEED = 20261120;

exposeRuntime(self as unknown as MessagePortLike, aiLabPlugin, SEED, { frameMs: 16 });
