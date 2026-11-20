/** Standalone build: the worker is published next to the page as ai-lab-worker.js. */
export function spawnWorker(): Worker {
  return new Worker(new URL("./ai-lab-worker.js", document.baseURI), { type: "module" });
}
