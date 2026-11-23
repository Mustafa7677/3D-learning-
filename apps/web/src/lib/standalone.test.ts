import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GitHub Pages serves the standalone build (hash routing). A page added to the Next app but not
 * to the standalone router, or a Next-only import without a shim, leaves that site blank.
 */
const web = join(__dirname, "..", "..");

describe("the standalone build", () => {
  const main = readFileSync(join(web, "standalone", "main.tsx"), "utf8");
  const build = readFileSync(join(web, "standalone", "build.mjs"), "utf8");

  it("routes every page of the app", () => {
    const pages = readdirSync(join(web, "src", "app"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(web, "src", "app", d.name, "page.tsx")) && d.name !== "labs")
      .map((d) => d.name);
    // "play" takes a code: it is routed as "#play=<code>".
    const missing = pages.filter((p) => !main.includes(`name === "${p}"`) && !main.includes(`"${p}="`));
    expect(missing).toEqual([]);
  });

  it("shims every next/* module the app imports", () => {
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, d.name);
        if (d.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(d.name) && !/\.test\./.test(d.name) && !p.includes(join("src", "app"))) for (const m of readFileSync(p, "utf8").matchAll(/from "(next\/[a-z]+)"/g)) used.add(m[1]!);
      }
    };
    walk(join(web, "src"));
    const shimmed = [...used].filter((m) => build.includes(`^${m.replace("/", "\\/")}$`));
    expect([...used].sort()).toEqual(shimmed.sort());
  });
});
