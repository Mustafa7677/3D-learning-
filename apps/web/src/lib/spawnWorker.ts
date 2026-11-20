/** Bundler-specific worker construction. The standalone build swaps this module out. */
export function spawnWorker(): Worker {
  return new Worker(new URL("../workers/ai-lab.worker.ts", import.meta.url), { type: "module" });
}
