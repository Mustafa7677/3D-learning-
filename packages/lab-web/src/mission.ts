/**
 * Mission "Бір қаланың интернеті", model v0: why the school site is fast in
 * the morning and slow when a lesson starts.
 *
 * One phone loads the school home page (HTML plus photos) over the school's
 * shared Wi-Fi uplink. Every number on the mission screen comes from here.
 * Deterministic: the same scenario and fix always give the same timings.
 *
 * Simplifications (said on screen too): everyone in the class starts at the
 * same moment; the uplink is shared fairly between downloads (processor
 * sharing); the server has a fixed number of workers and serves in arrival
 * order; the observed phone is in the middle of the queue.
 */

export const MISSION_SCHOOL = {
  /** Round trip from a phone to the server, ms. */
  rttMs: 40,
  /** DNS lookup on a phone that has not seen the name yet, ms. */
  dnsMs: 60,
  /** School uplink, kilobytes per second (50 Mbit/s). */
  uplinkKBps: 6250,
  /** Server: parallel workers and time per page request, ms. */
  workers: 4,
  serviceMs: 25,
  /** The page. */
  htmlKB: 40,
  photosKB: 2400,
  /** Photos after resizing for phones. */
  photosSmallKB: 400,
  /** Students in a class. */
  classSize: 30,
};

export type MissionFix = "none" | "resize" | "cache";

/** Who is loading the page, and who else is loading at the same moment. */
export interface MissionScenario {
  id: string;
  title: string;
  /** Phones loading at the same moment besides the observed one. */
  others: number;
  /** Has the observed phone opened the site before? */
  observedVisited: boolean;
  /** Have the other phones opened the site before? */
  othersVisited: boolean;
}

export const SCENARIOS: Record<"single" | "class" | "repeatClass" | "newClass", MissionScenario> = {
  single: { id: "single", title: "Бір телефон, таңертең", others: 0, observedVisited: true, othersVisited: true },
  class: { id: "class", title: "Сабақ басталды: бүкіл сынып бірге кірді", others: 29, observedVisited: true, othersVisited: true },
  repeatClass: { id: "repeatClass", title: "Кеше кірген сынып қайта кірді", others: 29, observedVisited: true, othersVisited: true },
  newClass: { id: "newClass", title: "Жаңа сынып: бәрі алғаш рет кіреді", others: 29, observedVisited: false, othersVisited: false },
};

export type SegmentId = "dns" | "connect" | "server" | "download";

export interface Segment {
  id: SegmentId;
  ms: number;
}

export interface MissionRun {
  scenario: MissionScenario;
  fix: MissionFix;
  segments: Segment[];
  totalMs: number;
  /** Kilobytes the observed phone downloaded, and the whole class. */
  observedKB: number;
  allKB: number;
  /** Requests waiting ahead of the observed one at the server. */
  queueAhead: number;
}

/** Bytes one phone downloads for the page. */
export function pageKB(visited: boolean, fix: MissionFix, m = MISSION_SCHOOL): number {
  const photos = fix === "resize" ? m.photosSmallKB : m.photosKB;
  // With caching on, a phone that has visited keeps the photos.
  const cachedPhotos = fix === "cache" && visited;
  return m.htmlKB + (cachedPhotos ? 0 : photos);
}

/**
 * Fair sharing of one link among downloads that start together: a download of
 * size x ends after sum(min(size_j, x)) / bandwidth.
 */
export function sharedFinishMs(mine: number, others: number[], kbps: number): number {
  const total = mine + others.reduce((s, x) => s + Math.min(x, mine), 0);
  return (total / kbps) * 1000;
}

export function runMission(scenario: MissionScenario, fix: MissionFix, m = MISSION_SCHOOL): MissionRun {
  const n = scenario.others + 1;
  // A phone that has visited remembers the name: no DNS lookup.
  const dns = scenario.observedVisited ? 0 : m.dnsMs;
  // TCP then TLS 1.3: two round trips.
  const connect = 2 * m.rttMs;
  // Requests arrive together; the observed one is in the middle of the line.
  const position = Math.ceil(n / 2);
  const queueAhead = position - 1;
  const server = Math.floor(queueAhead / m.workers) * m.serviceMs + m.serviceMs + m.rttMs;
  const mine = pageKB(scenario.observedVisited, fix, m);
  const theirs = Array.from({ length: scenario.others }, () => pageKB(scenario.othersVisited, fix, m));
  const download = Math.round(sharedFinishMs(mine, theirs, m.uplinkKBps));
  const segments: Segment[] = [
    { id: "dns", ms: dns },
    { id: "connect", ms: connect },
    { id: "server", ms: server },
    { id: "download", ms: download },
  ];
  return {
    scenario,
    fix,
    segments,
    totalMs: segments.reduce((s, x) => s + x.ms, 0),
    observedKB: mine,
    allKB: mine + theirs.reduce((s, x) => s + x, 0),
    queueAhead,
  };
}

/** The segment that takes the longest: what the hypothesis should point at. */
export const slowestSegment = (run: MissionRun): SegmentId => run.segments.reduce((a, b) => (b.ms > a.ms ? b : a)).id;

/** Seconds with one decimal and a Kazakh decimal comma: 12,3 с. */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} с`;
}
