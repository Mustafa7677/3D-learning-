import { BOXES, sanitize, type BoxId, type Build } from "@inside-tech/lab-arch";
import { solveChallenge } from "./challenges";

/** One experiment the learner wrote down. */
export interface Row {
  a: number;
  b: number;
  lamp: number;
}

export interface BoxProgress {
  log: Row[];
  build: Build;
  /** How many hints are open: 0, 1 or 2. */
  hint: number;
}

export interface BlackBoxSave {
  current: BoxId;
  solved: BoxId[];
  boxes: Record<BoxId, BoxProgress>;
}

const KEY = "inside-tech:blackbox";
const IDS = BOXES.map((b) => b.id);
const bit = (v: unknown) => (v === 1 ? 1 : 0);

export const freshBox = (): BoxProgress => ({ log: [], build: { parts: [], out: "A" }, hint: 0 });

export function emptySave(): BlackBoxSave {
  return { current: "pair", solved: [], boxes: { pair: freshBox(), alarm: freshBox(), corridor: freshBox() } };
}

/** Read the saved game; anything malformed falls back to a fresh start for that part. */
export function loadBlackBox(): BlackBoxSave {
  const save = emptySave();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<BlackBoxSave> | null;
    if (!raw || typeof raw !== "object") return save;
    if (IDS.includes(raw.current as BoxId)) save.current = raw.current as BoxId;
    if (Array.isArray(raw.solved)) save.solved = IDS.filter((id) => raw.solved!.includes(id));
    for (const id of IDS) {
      const b = raw.boxes?.[id] as Partial<BoxProgress> | undefined;
      if (!b || typeof b !== "object") continue;
      save.boxes[id] = {
        log: Array.isArray(b.log) ? b.log.slice(0, 40).map((r) => ({ a: bit(r?.a), b: bit(r?.b), lamp: bit(r?.lamp) })) : [],
        build: sanitize(b.build),
        hint: b.hint === 1 || b.hint === 2 ? b.hint : 0,
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return save;
}

export function saveBlackBox(save: BlackBoxSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable */
  }
}

/** Record a solved box once and pay the challenge XP. */
export function markSolved(save: BlackBoxSave, id: BoxId): BlackBoxSave {
  if (save.solved.includes(id)) return save;
  solveChallenge(`blackbox-${id}`);
  return { ...save, solved: [...save.solved, id] };
}
