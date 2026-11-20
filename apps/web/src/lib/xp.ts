"use client";

import { useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { lessonEntries } from "./lessons";
import { progressStore } from "./progress";

/** XP for a finished lesson and for each finished task inside one. */
export const XP_LESSON = 100;
export const XP_TASK = 10;
/** XP needed to go from level n to n + 1 grows by 100 each level: 300, 400, 500… */
export const levelCost = (level: number) => 200 + level * 100;

export interface PlayerStats {
  xp: number;
  level: number;
  /** XP earned inside the current level, and what the level needs. */
  into: number;
  need: number;
  lessonsDone: number;
  /** Finished lessons per lab id. */
  doneByLab: Record<string, number>;
}

export function playerStats(progress: LessonProgress[]): PlayerStats {
  let xp = 0;
  let lessonsDone = 0;
  const doneByLab: Record<string, number> = {};
  for (const p of progress) {
    const tasks = Object.values(p.completed).reduce((n, xs) => n + xs.length, 0);
    xp += tasks * XP_TASK;
    if (p.completedAt) {
      xp += XP_LESSON;
      lessonsDone++;
      const lab = lessonEntries.find((e) => e.lesson.id === p.lessonId)?.labId;
      if (lab) doneByLab[lab] = (doneByLab[lab] ?? 0) + 1;
    }
  }
  let level = 1;
  let into = xp;
  while (into >= levelCost(level)) {
    into -= levelCost(level);
    level++;
  }
  return { xp, level, into, need: levelCost(level), lessonsDone, doneByLab };
}

/** The visitor's stats from saved progress (local or server). */
export function usePlayer(): PlayerStats | undefined {
  const [stats, setStats] = useState<PlayerStats>();
  useEffect(() => {
    void progressStore()
      .list()
      .then((all) => setStats(playerStats(all)), () => setStats(playerStats([])));
  }, []);
  return stats;
}
