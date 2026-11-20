import { describe, expect, it } from "vitest";
import { Rng, SimulationRuntime, replay } from "@inside-tech/sim-core";
import { LessonEngine } from "@inside-tech/lesson-engine";
import {
  EOS,
  attention,
  encodeWord,
  entropy,
  langLabPlugin,
  languageLessons,
  languageModels,
  nearest,
  nextDistribution,
  nextTokens,
  sample,
  selfAttention,
  shapeDistribution,
  softmax,
  tokenize,
  trainBpe,
  type LangLabAction,
  type LangLabState,
} from "../index";

describe("BPE", () => {
  it("merges the most frequent pair first and tokenises deterministically", () => {
    const m = trainBpe(["аа", "аа", "аб"], 5);
    expect(m.merges[0]).toEqual(["а", "а"]);
    expect(encodeWord("аа", m, 0)).toEqual(["а", "а", "▁"]);
    expect(encodeWord("аа", m, 5).join("")).toBe("аа▁");
  });

  it("more merges never produce more tokens", () => {
    const { bpe } = languageModels();
    for (const w of ["мысық", "бағдарламашы", "компьютерде", "жаңасөз"]) {
      let prev = Infinity;
      for (const n of [0, 10, 40, 200]) {
        const len = encodeWord(w, bpe, n).length;
        expect(len).toBeLessThanOrEqual(prev);
        expect(encodeWord(w, bpe, n).join("")).toBe(w + "▁");
        prev = len;
      }
    }
  });
});

describe("embeddings", () => {
  it("are unit length and place topic words near each other", () => {
    const { emb } = languageModels();
    for (const v of emb.vectors) expect(Math.hypot(...v)).toBeCloseTo(1, 6);
    const near = (w: string) => nearest(emb, w, 8).map((x) => x.word);
    expect(near("компьютер")).toEqual(expect.arrayContaining(["бағдарламаны"]));
    expect(near("жылқы")).toEqual(expect.arrayContaining(["шөп"]));
    expect(near("компьютер")).not.toContain("шөп");
  });
});

describe("attention", () => {
  const { emb } = languageModels();
  const toks = ["мысық", "пен", "ит", "үйде", "сүт", "ішеді"];
  it("rows are probability distributions and respect the causal mask", () => {
    const a = selfAttention(toks, emb, { sharpness: 8, posWeight: 1, causal: true, maskSelf: false });
    a.weights.forEach((row, i) => {
      expect(row.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
      row.forEach((w, j) => {
        if (j > i) expect(w).toBe(0);
      });
    });
  });
  it("sharpness 0 is uniform; higher sharpness lowers entropy", () => {
    const flat = selfAttention(toks, emb, { sharpness: 0, posWeight: 0, causal: false, maskSelf: true });
    expect(entropy(flat.weights[2]!)).toBeCloseTo(Math.log(5), 6);
    const sharp = selfAttention(toks, emb, { sharpness: 100, posWeight: 0, causal: false, maskSelf: true });
    expect(entropy(sharp.weights[4]!)).toBeLessThan(0.3);
  });
  it("softmax handles masked entries", () => {
    expect(softmax([-Infinity, 0, 0])).toEqual([0, 0.5, 0.5]);
    expect(softmax([-Infinity])).toEqual([0]);
  });
});

describe("n-gram LM", () => {
  const { lm } = languageModels();
  it("is a normalised distribution that prefers seen continuations", () => {
    const d = nextDistribution(lm, ["компьютер"]);
    expect(d.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1, 9);
    expect(d[0]!.token).toBe("бағдарламаны");
  });
  it("temperature → 0 is greedy, top-k truncates", () => {
    const d = nextDistribution(lm, ["мысық"]);
    expect(shapeDistribution(d, 0, 10)[0]!.p).toBe(1);
    expect(shapeDistribution(d, 1, 3)).toHaveLength(3);
    const hot = shapeDistribution(d, 3, 10);
    const cold = shapeDistribution(d, 0.3, 10);
    expect(entropy(hot.map((x) => x.p))).toBeGreaterThan(entropy(cold.map((x) => x.p)));
    expect(sample(shapeDistribution(d, 0, 10), new Rng(1))).toBe(d[0]!.token);
  });
});

describe("lang-lab plugin", () => {
  it("generation is deterministic and replayable", () => {
    const rt = new SimulationRuntime(langLabPlugin, 3);
    rt.dispatch({ type: "lm/setPrompt", prompt: "бала" });
    rt.dispatch({ type: "lm/generate", max: 8 });
    const s = rt.getState();
    expect(s.lm.generated.length).toBeGreaterThan(0);
    expect(s.lm.generated.length <= 8 || s.lm.generated.at(-1) === EOS).toBe(true);
    expect(replay(langLabPlugin, rt.record())).toEqual(s);
  });
  it("selectors stay consistent with the text", () => {
    let s = langLabPlugin.initialize(1);
    s = langLabPlugin.dispatch(s, { type: "text/set", text: "Мысық, сүт ішеді!" });
    expect(tokenize(s)).toHaveLength(3);
    expect(attention(s).tokens).toEqual(["мысық", "сүт", "ішеді"]);
    expect(nextTokens(s).shaped.length).toBeLessThanOrEqual(10);
    s = langLabPlugin.dispatch(s, { type: "token/select", index: 99 });
    expect(s.selectedToken).toBeNull();
    s = langLabPlugin.dispatch(s, { type: "word/select", word: "жоқсөз" });
    expect(s.selectedWord).toBeNull();
  });
});

const scripts: Record<string, Record<string, (d: (a: LangLabAction) => void, s: () => LangLabState) => void>> = {
  "ai-6-transformers": {
    tokens: (d) => {
      d({ type: "text/set", text: "бағдарламашы компьютерде код жазады" });
      for (const n of [0, 10, 200]) d({ type: "bpe/setMerges", merges: n });
    },
    embeddings: (d) => {
      for (const w of ["мысық", "компьютер", "аспан"]) d({ type: "word/select", word: w });
    },
    attention: (d) => {
      d({ type: "token/select", index: 0 });
      d({ type: "token/select", index: 4 });
      d({ type: "attn/set", params: { causal: true } });
    },
    sharpness: (d) => {
      d({ type: "attn/set", params: { causal: false } });
      d({ type: "token/select", index: 4 });
      d({ type: "attn/set", params: { sharpness: 0 } });
      d({ type: "attn/set", params: { sharpness: 100 } });
    },
  },
  "ai-7-llm": {
    next: (d) => {
      d({ type: "lm/setPrompt", prompt: "бала" });
      d({ type: "lm/setPrompt", prompt: "компьютер" });
    },
    sample: (d) => {
      d({ type: "lm/setPrompt", prompt: "мысық" });
      for (let i = 0; i < 5; i++) {
        d({ type: "lm/clear" });
        d({ type: "lm/step" });
      }
    },
    temperature: (d) => {
      d({ type: "lm/set", params: { temperature: 0.2 } });
      for (let i = 0; i < 3; i++) {
        d({ type: "lm/clear" });
        d({ type: "lm/step" });
      }
      d({ type: "lm/set", params: { temperature: 2 } });
      for (let i = 0; i < 3; i++) {
        d({ type: "lm/clear" });
        d({ type: "lm/step" });
      }
    },
    topk: (d) => {
      d({ type: "lm/set", params: { topK: 1 } });
      for (let i = 0; i < 3; i++) {
        d({ type: "lm/clear" });
        d({ type: "lm/step" });
      }
    },
  },
};

describe("language lessons are completable", () => {
  for (const lesson of languageLessons) {
    it(lesson.id, () => {
      const rt = new SimulationRuntime(langLabPlugin, 42);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const enter = () => engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      const d = (a: LangLabAction) => {
        rt.dispatch(a);
        sync();
      };
      enter();
      sync();
      for (const step of lesson.steps) {
        const script = scripts[lesson.id]?.[step.id];
        expect(script, `script for ${step.id}`).toBeDefined();
        script!(d, () => rt.getState());
        expect(engine.view().objectives.every((o) => o.done), `${lesson.id}/${step.id}`).toBe(true);
        if (!engine.isLastStep()) {
          engine.advance();
          enter();
          sync();
        }
      }
      expect(engine.isLessonComplete()).toBe(true);
    });
  }
});
