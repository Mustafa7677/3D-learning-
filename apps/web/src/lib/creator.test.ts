import { describe, expect, it } from "vitest";
import { compileLesson, LessonEngine, validateLessonSpec } from "@inside-tech/lesson-engine";
import { KINDS, KIND_IDS, freshId, hasSetup, newSpec, presetOf, presetText, toggleSetup } from "./creator";

describe("lesson creator", () => {
  it("every preset can be recognised back from the condition it builds", () => {
    for (const k of KINDS) {
      for (const p of k.conditions) {
        const v = p.value === undefined ? 1 : p.value + 7;
        const m = presetOf(k.kind, p.build(v));
        expect(m?.preset.id, `${k.kind}/${p.id}`).toBe(p.id);
        if (p.value !== undefined) expect(m?.value).toBe(v);
      }
    }
  });

  it("a new lesson for any simulation is valid and runnable", () => {
    for (const kind of KIND_IDS) {
      const spec = newSpec(kind);
      expect(validateLessonSpec(spec, KIND_IDS), kind).toEqual([]);
      const engine = new LessonEngine(compileLesson(spec));
      expect(engine.view().objectives).toHaveLength(1);
    }
  });

  it("setups toggle on and off without touching other actions", () => {
    const [a, b] = KINDS[0]!.setups;
    let list = toggleSetup([], a!);
    list = toggleSetup(list, b!);
    expect(hasSetup(list, a!) && hasSetup(list, b!)).toBe(true);
    list = toggleSetup(list, a!);
    expect(hasSetup(list, a!)).toBe(false);
    expect(list).toEqual(b!.actions);
  });

  it("fills numbers into objective text and finds free ids", () => {
    const test = KINDS[0]!.conditions.find((c) => c.id === "test")!;
    expect(presetText(test, 95)).toBe("Test дәлдігі ≥ 95%");
    expect(freshId("step", ["step-1", "step-2"])).toBe("step-3");
  });
});
