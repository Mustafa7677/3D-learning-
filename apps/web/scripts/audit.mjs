// Quality audit: every page on a desktop and a phone, for script errors, console errors,
// horizontal overflow and accessibility (axe-core, serious and critical rules).
// Usage: start the app (next start -p 3201), then: node scripts/audit.mjs [baseUrl]
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] ?? "http://localhost:3201";
const ROUTES = ["/", "/today", "/tools", "/focus", "/recall", "/learn", "/problems", "/tactics", "/parsons", "/ticket", "/cards", "/notebook", "/comic", "/mission", "/journey", "/gazette", "/blackbox", "/sky", "/passport", "/create", "/teacher", "/account", "/play", "/labs/math", "/labs/ai", "/labs/math/la-1-vectors", "/labs/web/web-10-cache", "/labs/math/ag-4-conics"];
const VIEWS = [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
];

const browser = await chromium.launch();
const report = [];
for (const [view, viewport] of VIEWS) {
  const ctx = await browser.newContext({ viewport });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !/WebGL|webgl|GPU|Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 160)}`));
    await page.goto(base + route, { waitUntil: "networkidle" }).catch((e) => errors.push(`goto: ${e.message}`));
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    let axe = [];
    try {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      axe = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") ?? "", help: v.help }));
    } catch (e) {
      errors.push(`axe: ${e.message}`);
    }
    report.push({ view, route, errors, overflow, axe });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

let bad = 0;
for (const r of report) {
  const issues = [...r.errors, ...(r.overflow > 1 ? [`overflow ${r.overflow}px`] : []), ...r.axe.map((a) => `axe ${a.impact} ${a.id} ×${a.n}: ${a.sample} (${a.help})`)];
  if (issues.length) {
    bad++;
    console.log(`\n${r.view} ${r.route}`);
    for (const i of issues) console.log(`  - ${i}`);
  }
}
console.log(`\n${report.length - bad}/${report.length} clean`);
