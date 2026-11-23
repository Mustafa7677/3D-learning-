/**
 * Ойын залы: four short arcade games, each a fast drill of one idea.
 *   Бит-метеор      binary numbers under time pressure
 *   Қақпа жарысы    logic gates, from one gate to chains
 *   Фишинг сүзгісі  spotting a fake message in seconds
 *   Кэш сақшысы     choosing what to evict, scored against LRU, FIFO and the optimal
 * The rules live here as plain functions, so they are tested without a screen.
 */

export type GameId = "bits" | "gates" | "phish" | "cache";

export interface GameInfo {
  id: GameId;
  title: string;
  topic: string;
  lab: string;
  pitch: string;
  how: string;
  /** Scores for bronze, silver, gold. */
  medals: [number, number, number];
  glyph: string;
}

export const GAMES: GameInfo[] = [
  {
    id: "bits",
    title: "Бит-метеор",
    topic: "Екілік сандар",
    lab: "arch",
    pitch: "Ондық сандар жазылған метеорлар құлап келеді. Биттерді қосып, дәл сол санды жина: лазер атылады!",
    how: "Биттерді басып немесе 1-8 пернелерімен қос. Сан метеордың санына тең болса, ол жарылады. Жерге үш метеор түссе, ойын бітеді.",
    medals: [150, 500, 1200],
    glyph: "☄",
  },
  {
    id: "gates",
    title: "Қақпа жарысы",
    topic: "Логикалық қақпалар",
    lab: "arch",
    pitch: "60 секунд. Кіріс шамдары жанады, қақпа шығысы 0 ме, 1 ме? Неғұрлым жылдам, соғұрлым үлкен комбо.",
    how: "0 немесе 1 батырмасын бас (пернетақтада да 0 және 1). Қате жауап комбоны нөлдейді және 3 секунд алады.",
    medals: [150, 400, 800],
    glyph: "⏻",
  },
  {
    id: "phish",
    title: "Фишинг сүзгісі",
    topic: "Киберқауіпсіздік",
    lab: "sec",
    pitch: "Сен поштаның сақшысысың. Хаттар бірінен соң бірі келеді: қайсысы шын, қайсысы алаяқтың тұзағы?",
    how: "← «Қауіпсіз» немесе → «Фишинг». Уақыт шектеулі. Қателессең, неге екенін көресің. Үш қате: ойын бітеді.",
    medals: [100, 250, 450],
    glyph: "✉",
  },
  {
    id: "cache",
    title: "Кэш сақшысы",
    topic: "Жад иерархиясы",
    lab: "arch",
    pitch: "Процессор деректерді сұрайды, кэште тек 3 орын бар. Кімді шығарасың? Соңында LRU мен оптималды алгоритммен жарысасың.",
    how: "Сұралған дерек кэште болса, бұл тиіс (hit). Болмаса және орын толы болса, шығарылатын ұяшықты бас. Келесі сұраныстарды көріп, алдын ала ойла. Ұпай: оптималды алгоритмнің нәтижесінен неше пайыз жинадың.",
    medals: [70, 85, 100],
    glyph: "▦",
  },
];

export const medalOf = (game: GameInfo, score: number): 0 | 1 | 2 | 3 => (score >= game.medals[2] ? 3 : score >= game.medals[1] ? 2 : score >= game.medals[0] ? 1 : 0);
export const MEDAL_WORD = ["", "Қола", "Күміс", "Алтын"] as const;

/** A small seeded generator, so a round can be replayed in a test. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Бит-метеор

/** The number the switches show; bits[0] is the highest bit. */
export const bitsValue = (bits: boolean[]) => bits.reduce((n, b) => n * 2 + (b ? 1 : 0), 0);

export function bitLevel(zaps: number) {
  const level = 1 + Math.floor(zaps / 5);
  const width = Math.min(8, 3 + level);
  return {
    level,
    width,
    /** Seconds a meteor takes to fall. */
    fall: Math.max(7, 16 - level * 1.2),
    /** Seconds between new meteors. */
    every: Math.max(2.2, 5.5 - level * 0.45),
  };
}

export const bitPoints = (level: number, height: number) => 10 * level + Math.round((1 - height) * 10);

// ---------------------------------------------------------------- Қақпа жарысы

export type GateName = "AND" | "OR" | "NOT" | "XOR" | "NAND" | "NOR";

export const GATE_WORD: Record<GateName, string> = {
  AND: "ЖӘНЕ",
  OR: "НЕМЕСЕ",
  NOT: "ЕМЕС",
  XOR: "НЕ БІРІ, НЕ БІРІ",
  NAND: "ЖӘНЕ-ЕМЕС",
  NOR: "НЕМЕСЕ-ЕМЕС",
};

export function gate(g: GateName, a: boolean, b = false): boolean {
  switch (g) {
    case "AND":
      return a && b;
    case "OR":
      return a || b;
    case "NOT":
      return !a;
    case "XOR":
      return a !== b;
    case "NAND":
      return !(a && b);
    case "NOR":
      return !(a || b);
  }
}

export interface GateRound {
  /** One gate on A and B, or a second gate taking the first result and C. */
  first: GateName;
  second?: GateName;
  inputs: boolean[];
  answer: boolean;
}

export function gateRound(score: number, r: () => number): GateRound {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const easy: GateName[] = ["AND", "OR", "NOT"];
  const all: GateName[] = ["AND", "OR", "NOT", "XOR", "NAND", "NOR"];
  const two: GateName[] = ["AND", "OR", "XOR", "NAND", "NOR"];
  const bit = () => r() < 0.5;
  if (score < 60) {
    const first = pick(easy);
    const inputs = first === "NOT" ? [bit()] : [bit(), bit()];
    return { first, inputs, answer: gate(first, inputs[0]!, inputs[1]) };
  }
  if (score < 180) {
    const first = pick(all);
    const inputs = first === "NOT" ? [bit()] : [bit(), bit()];
    return { first, inputs, answer: gate(first, inputs[0]!, inputs[1]) };
  }
  const first = pick(two);
  const second = pick(two);
  const inputs = [bit(), bit(), bit()];
  return { first, second, inputs, answer: gate(second, gate(first, inputs[0]!, inputs[1]), inputs[2]) };
}

export const GATE_TIME = 60;
export const COMBO_MAX = 5;

// ---------------------------------------------------------------- Фишинг сүзгісі

export interface Letter {
  from: string;
  subject: string;
  body: string;
  link?: string;
  phish: boolean;
  why: string;
}

export const LETTERS: Letter[] = [
  { from: "Kaspi Bank <noreply@kaspi-bonus.xyz>", subject: "Сізге 50 000 ₸ бонус!", body: "Бонусты алу үшін 24 сағат ішінде карта нөмірі мен CVV кодын енгізіңіз.", link: "kaspi-bonus.xyz/get", phish: true, why: "Банк ешқашан CVV сұрамайды, ал мекенжай kaspi.kz емес, kaspi-bonus.xyz. Асықтыру да тұзақтың белгісі." },
  { from: "Мектеп <info@school42.edu.kz>", subject: "Ертеңгі сабақ кестесі", body: "Ертең 3-сабақ 204-кабинетте өтеді. Кесте сайтта жаңартылды.", link: "school42.edu.kz/kesteler", phish: false, why: "Таныс мекенжай, ештеңе сұрамайды, асықтырмайды: кәдімгі хабарлама." },
  { from: "Instagram <security@instagrarn.com>", subject: "Аккаунтыңыз бұғатталады", body: "Біреу сіздің аккаунтыңызға кірді. Құпиясөзді растамасаңыз, 1 сағатта жойылады.", link: "instagrarn.com/verify", phish: true, why: "instagrarn: «m» орнына «rn» жазылған. Қорқыту мен уақыт шегі: классикалық фишинг." },
  { from: "GitHub <noreply@github.com>", subject: "[GitHub] Жаңа кіру", body: "Аккаунтыңызға Алматыдан Chrome арқылы кірілді. Бұл сіз болсаңыз, ештеңе істемеңіз.", link: "github.com/settings/security", phish: false, why: "Нағыз домен github.com, құпиясөз сұрамайды, тек хабарлайды." },
  { from: "Әкем <+7 701 *** 12 34>", subject: "SMS", body: "Балам, бұл менің жаңа нөмірім. Шұғыл 20 000 ₸ мына картаға аудар, кейін түсіндіремін.", phish: true, why: "Жаңа нөмір және шұғыл ақша: туыстың атын жамылған алаяқтық. Ескі нөміріне қоңырау шалып тексер." },
  { from: "Steam <support@steamcommunity.com>", subject: "Сатып алу түбіртегі", body: "Сіз «Stardew Valley» ойынын сатып алдыңыз. Сома: 2 990 ₸.", phish: false, why: "Ресми домен, ештеңе енгізуді сұрамайды. Сен сатып алсаң, бұл кәдімгі түбіртек." },
  { from: "Google <no-reply@accounts.google.com.security-check.ru>", subject: "Қауіпсіздік ескертуі", body: "Құпиясөзіңіз ескірді. Жаңартыңыз.", link: "accounts.google.com.security-check.ru", phish: true, why: "Доменді оңнан оқы: шын домен security-check.ru, ал «google.com» тек алдау үшін басында тұр." },
  { from: "Ұстаз <ustaz@insidetech.kz>", subject: "Үй тапсырмасы тексерілді", body: "Жарайсың! Екілік сандар тапсырмасы 10/10. Келесі сабақта логикалық қақпалар.", phish: false, why: "Ештеңе сұрамайды, сілтеме жоқ, күткен адамнан келді." },
  { from: "Почта <delivery@kazpost-track.top>", subject: "Сәлемдеме тоқтатылды", body: "Мекенжай толық емес. Жеткізу үшін 350 ₸ төлеңіз.", link: "kazpost-track.top/pay", phish: true, why: "Kazpost домені .top емес. Аз ақша сұрау сенімді арттыру үшін: карта деректері ұрланады." },
  { from: "Microsoft <account-security-noreply@accountprotection.microsoft.com>", subject: "Қауіпсіздік коды", body: "Сіздің кіру кодыңыз: 482913. Сіз сұрамасаңыз, бұл хатты елемеңіз.", phish: false, why: "Ресми домен және код бар, бірақ ешқайда енгізуді сұрамайды. Бірақ бұл кодты ешкімге айтпа." },
  { from: "Ойын турнирі <prize@free-robux.win>", subject: "Сіз 10 000 Robux ұттыңыз!", body: "Жүлдені алу үшін аккаунт логині мен құпиясөзін жазыңыз.", link: "free-robux.win", phish: true, why: "Тегін ұтыс және логин мен құпиясөз сұрау: ешбір нағыз сервис құпиясөзді хатпен сұрамайды." },
  { from: "Нұрай <nuray.s@gmail.com>", subject: "Жоба файлы", body: "Сәлем! Кешегі презентацияның соңғы нұсқасын Google Drive-қа салдым, қарап шықшы.", link: "drive.google.com/file/d/1aB…", phish: false, why: "Таныс адам, күткен жоба, нағыз drive.google.com мекенжайы. Күмәнді болса, Нұрайдан жеке сұрауға болады." },
  { from: "IT бөлімі <admin@school42-edu.kz.co>", subject: "Пошта жәшігі толды", body: "Поштаңыз 99% толды. Сақтап қалу үшін мектеп логиніңізбен кіріңіз.", link: "school42-edu.kz.co/login", phish: true, why: "Мектептің нақты домені school42.edu.kz. Мына мекенжай басқа (.co), ал логин сұрау: тұзақ." },
  { from: "eGov <egov@egov.kz>", subject: "Анықтама дайын", body: "Сіздің сұраған анықтамаңыз жеке кабинетте дайын.", link: "egov.kz", phish: false, why: "Сен сұраған анықтама, ресми egov.kz домені, сілтеме басты бетке апарады." },
  { from: "Netflix <billing@netflix-payments.help>", subject: "Төлем сәтсіз", body: "Жазылым тоқтатылды. Карта деректерін жаңартыңыз, әйтпесе аккаунт жойылады.", link: "netflix-payments.help", phish: true, why: "Бөтен домен, қорқыту және карта деректерін сұрау. Жазылымды тек қосымшаның өзінен тексер." },
  { from: "Кітапхана <lib@school42.edu.kz>", subject: "Кітапты қайтару", body: "«Алгоритмдер» кітабын қайтару мерзімі ертең бітеді.", phish: false, why: "Ештеңе сұрамайды, мектептің өз доменінен, мағынасы түсінікті." },
  { from: "WhatsApp", subject: "Хабарлама", body: "Сәлем, саған 6 таңбалы код келді ме? Қате жіберіп алдым, айтып жіберші.", phish: true, why: "Бұл аккаунтты ұрлау тәсілі: код сенің аккаунтыңа кіру кілті. Кодты ешкімге айтпа." },
  { from: "Telegram <+42 777>", subject: "Кіру коды", body: "Telegram коды: 51623. Бұл кодты ешкімге бермеңіз, тіпті Telegram қызметкерлеріне де.", phish: false, why: "Ресми қызмет хабары, сен кіріп жатқанда келеді және кодты ешкімге берме деп ескертеді." },
  { from: "Олимпиада <olymp@ozat-olimpiada.kz>", subject: "Тіркелу ашылды", body: "Информатика олимпиадасына тіркелу 1 желтоқсанға дейін. Ереже сайтта.", link: "ozat-olimpiada.kz/ereje", phish: false, why: "Ақша да, құпиясөз де сұрамайды, мерзімі шынайы, тек ақпарат." },
  { from: "Apple <apple-id@secure-icloud-login.com>", subject: "Apple ID бұғатталды", body: "Күдікті әрекет анықталды. Растау үшін кіріп, банк картасын енгізіңіз.", link: "secure-icloud-login.com", phish: true, why: "Apple домені apple.com. «secure» және «login» деген сөздер қауіпсіздік емес, алдау белгісі." },
];

export const letterTime = (score: number) => Math.max(5, 11 - score / 60);

// ---------------------------------------------------------------- Кэш сақшысы

export const CACHE_SLOTS = 3;
export const PAGES = ["A", "B", "C", "D", "E", "F"];

/** A request stream with locality: recent pages come back often, as in real programs. */
export function cacheSequence(seed: number, length = 24): string[] {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < length; i++) {
    const recent = out.slice(-4);
    out.push(recent.length && r() < 0.55 ? recent[Math.floor(r() * recent.length)]! : PAGES[Math.floor(r() * PAGES.length)]!);
  }
  return out;
}

type Policy = "lru" | "fifo" | "opt";

/** Hits a policy scores on the stream with k slots. */
export function simulate(seq: string[], k: number, policy: Policy): number {
  const slots: string[] = [];
  const lastUse = new Map<string, number>();
  const loaded = new Map<string, number>();
  let hits = 0;
  seq.forEach((page, i) => {
    if (slots.includes(page)) {
      hits++;
    } else if (slots.length < k) {
      slots.push(page);
      loaded.set(page, i);
    } else {
      let victim: string;
      if (policy === "fifo") victim = slots.reduce((a, b) => (loaded.get(a)! <= loaded.get(b)! ? a : b));
      else if (policy === "lru") victim = slots.reduce((a, b) => (lastUse.get(a)! <= lastUse.get(b)! ? a : b));
      else {
        const nextUse = (p: string) => {
          const j = seq.indexOf(p, i + 1);
          return j === -1 ? Infinity : j;
        };
        victim = slots.reduce((a, b) => (nextUse(a) >= nextUse(b) ? a : b));
      }
      slots[slots.indexOf(victim)] = page;
      loaded.set(page, i);
    }
    lastUse.set(page, i);
  });
  return hits;
}

// ---------------------------------------------------------------- best scores

const KEY = "inside-tech:arcade";

export function loadBest(): Partial<Record<GameId, number>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const out: Partial<Record<GameId, number>> = {};
    for (const g of GAMES) if (typeof v?.[g.id] === "number" && Number.isFinite(v[g.id])) out[g.id] = v[g.id];
    return out;
  } catch {
    return {};
  }
}

/** Save a score; returns true when it is a new best. */
export function saveScore(id: GameId, score: number): boolean {
  const best = loadBest();
  if ((best[id] ?? -1) >= score) return false;
  best[id] = score;
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable */
  }
  return true;
}
