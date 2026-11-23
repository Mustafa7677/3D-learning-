"use client";

/**
 * Tiny synthesized sound effects for the arcade, made with the Web Audio API: no files to load.
 * Sound is off until the learner turns it on, and the choice is remembered.
 */
const KEY = "inside-tech:sound";
let ctx: AudioContext | undefined;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

type Sfx = "hit" | "coin" | "boom" | "shoot" | "power" | "lose" | "wave" | "squash";

const NOTES: Record<Sfx, { f: number; to: number; dur: number; type: OscillatorType; vol: number }> = {
  hit: { f: 520, to: 180, dur: 0.12, type: "square", vol: 0.08 },
  coin: { f: 880, to: 1320, dur: 0.09, type: "triangle", vol: 0.09 },
  boom: { f: 160, to: 40, dur: 0.35, type: "sawtooth", vol: 0.12 },
  shoot: { f: 1200, to: 700, dur: 0.05, type: "square", vol: 0.03 },
  power: { f: 440, to: 1760, dur: 0.3, type: "triangle", vol: 0.1 },
  lose: { f: 330, to: 80, dur: 0.6, type: "sawtooth", vol: 0.12 },
  wave: { f: 300, to: 600, dur: 0.25, type: "square", vol: 0.06 },
  squash: { f: 240, to: 90, dur: 0.1, type: "square", vol: 0.09 },
};

export function play(kind: Sfx) {
  if (typeof window === "undefined" || !soundOn()) return;
  try {
    ctx ??= new AudioContext();
    const n = NOTES[kind];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = n.type;
    o.frequency.setValueAtTime(n.f, t);
    o.frequency.exponentialRampToValueAtTime(n.to, t + n.dur);
    g.gain.setValueAtTime(n.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + n.dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}
