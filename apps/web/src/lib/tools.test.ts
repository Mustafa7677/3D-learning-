import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_GROUPS } from "./tools";

describe("tools hub", () => {
  it("every tool is a real page, listed once", () => {
    const hrefs = TOOL_GROUPS.flatMap((g) => g.items.map((t) => t.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(existsSync(join(__dirname, "..", "app", h.slice(1), "page.tsx")), h).toBe(true);
    expect(/[–—]/.test(JSON.stringify(TOOL_GROUPS))).toBe(false);
  });
});
