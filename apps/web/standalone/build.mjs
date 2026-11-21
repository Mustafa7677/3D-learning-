// Builds a static, single-page version of the web app (hash routing, no server)
// into dist-artifact/: index.html + app.js + app.css + ai-lab-worker.js.
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, "dist-artifact");

const shims = {
  name: "next-shims",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: resolve(here, "shims/link.tsx") }));
    b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: resolve(here, "shims/dynamic.tsx") }));
    b.onResolve({ filter: /\/spawnWorker$/ }, () => ({ path: resolve(here, "shims/spawnWorker.ts") }));
    b.onResolve({ filter: /^@\// }, (a) => b.resolve("./" + a.path.slice(2), { resolveDir: resolve(root, "src"), kind: a.kind }));
    // Fonts come from Google Fonts in the standalone page.
    b.onResolve({ filter: /^@fontsource\// }, (a) => ({ path: a.path, namespace: "empty" }));
    b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "css" }));
  },
};

const common = {
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(process.env.NEXT_PUBLIC_API_URL ?? ""), "process.env.NEXT_PUBLIC_STANDALONE": '"1"' },
  logLevel: "warning",
  plugins: [shims],
  legalComments: "none",
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await build({ ...common, entryPoints: { app: resolve(here, "main.tsx") }, outdir: out });
await build({ ...common, entryPoints: { "ai-lab-worker": resolve(root, "src/workers/ai-lab.worker.ts") }, outdir: out });

const css = await readFile(resolve(out, "app.css"), "utf8");
const html = `<title>INSIDE TECH</title>
<meta name="description" content="IT технологияларын 3D симуляциялар арқылы зерттеуге арналған платформа: AI LAB.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Unbounded:wght@500;600&family=PT+Serif:wght@400;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`;
// FULL_HTML=1 emits a complete document for ordinary static hosts (GitHub Pages);
// the default fragment is for hosts that wrap the page in their own skeleton.
const page = process.env.FULL_HTML
  ? `<!doctype html>\n<html lang="kk">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${html.replace('<div id="root"></div>\n<script type="module" src="app.js"></script>\n', "")}</head>\n<body>\n<div id="root"></div>\n<script type="module" src="app.js"></script>\n</body>\n</html>\n`
  : html;
await writeFile(resolve(out, "index.html"), page);
await rm(resolve(out, "app.css"));
console.log("built", out);
