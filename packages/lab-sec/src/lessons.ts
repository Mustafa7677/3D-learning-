import { lessonCerts, lessonDh, lessonHmac, lessonModes, secMiddleContent } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { secContent } from "./content";
import { sha256 } from "./crypto";
import { secDeepDives } from "./deep";
import type { SecLabAction, SecLabState } from "./plugin";
import { lessonPsetSec } from "./pset";
import { RELEASE_TEXT } from "./text";

type L = LessonDefinition<SecLabState, SecLabAction>;

export const RELEASE_HASH = sha256(RELEASE_TEXT);
/** A tampered copy: the digit 0 replaced by the letter O. */
export const FAKE_RELEASE = "INSIDE TECH v1.O";

export const lessonCaesar: L = {
  id: "sec-1-caesar",
  labId: "sec",
  order: 1,
  title: "Caesar Cipher",
  summary: "Ең көне шифр: әріптерді жылжыту. Және оны 42 кілтті тексеріп бұзу.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "encrypt",
      title: "Шифрлау",
      body: "",
      focus: "cipher",
      onEnter: [{ type: "mode/set", mode: "cipher" }, { type: "cipher/source", source: "own" }, { type: "cipher/shift", shift: 0 }],
      objectives: [{ id: "shift", text: "Өз мәтініңді нөлден басқа кілтпен шифрла", check: (s) => s.stats.ownShifts.length > 0 }],
    },
    {
      id: "decrypt",
      title: "Дешифрлау",
      body: "",
      focus: "cipher",
      objectives: [{ id: "back", text: "Шифрмәтінді дұрыс кілтпен ашып, бастапқы мәтінді қайтар", check: (s) => s.stats.ownDecrypted > 0 }],
    },
    {
      id: "brute",
      title: "Барлық кілтті тексеру",
      body: "",
      focus: "cipher",
      onEnter: [{ type: "cipher/source", source: "short" }],
      objectives: [{ id: "solve", text: "Кілтін білмей тұрып, қысқа хабарды аш", check: (s) => s.stats.solved.includes("short") }],
    },
  ],
};

export const lessonFrequency: L = {
  id: "sec-2-frequency",
  labId: "sec",
  order: 2,
  title: "Frequency Analysis",
  summary: "Әріптердің жиілігі шифрды «сатып қояды»: аль-Кинди әдісімен бұзу.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "attack",
      title: "Жиілік бойынша шабуыл",
      body: "",
      focus: "cipher",
      onEnter: [{ type: "mode/set", mode: "cipher" }, { type: "cipher/source", source: "long" }],
      objectives: [
        { id: "freq", text: "Шифрмәтіннің әріп жиілігін аш", check: (s) => s.stats.frequencyViews > 0 },
        { id: "solve", text: "Ең жиі әріпті «а» деп болжап, кілтті тап", check: (s) => s.stats.solved.includes("long") },
      ],
    },
  ],
};

export const lessonXor: L = {
  id: "sec-3-xor",
  labId: "sec",
  order: 3,
  title: "XOR & One-Time Pad",
  summary: "Теориялық тұрғыдан бұзылмайтын шифр: және оны бұзатын бір қате.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "otp",
      title: "Бір реттік блокнот",
      body: "",
      focus: "xor",
      onEnter: [{ type: "mode/set", mode: "xor" }, { type: "xor/set", message: "ATTACK AT DAWN", key: "K" }],
      objectives: [{ id: "otp", text: "Кілт хабардан қысқа болмайтындай шифрла", check: (s) => s.stats.xorRuns.some((r) => r.keyLen >= r.msgLen) }],
    },
    {
      id: "reuse",
      title: "Кілтті қайта қолдану",
      body: "",
      focus: "xor",
      objectives: [
        {
          id: "reuse",
          text: "Бір кілтпен екі түрлі хабарды шифрла",
          check: (s) => s.stats.xorRuns.some((r, i) => s.stats.xorRuns.some((q, j) => j !== i && q.key === r.key && q.message !== r.message && q.keyLen >= q.msgLen)),
        },
      ],
    },
  ],
};

export const lessonHash: L = {
  id: "sec-4-hash",
  labId: "sec",
  order: 4,
  title: "Hashing",
  summary: "SHA-256: кез келген деректің 256 биттік «саусақ ізі».",
  estimatedMinutes: 20,
  steps: [
    {
      id: "hash",
      title: "Хэш функциясы",
      body: "",
      focus: "hash",
      onEnter: [{ type: "mode/set", mode: "hash" }],
      objectives: [{ id: "three", text: "Кемінде 3 түрлі мәтіннің хэшін ал", check: (s) => s.stats.hashes.length >= 3 }],
    },
    {
      id: "avalanche",
      title: "Лавина әсері",
      body: "",
      focus: "hash",
      objectives: [{ id: "flip", text: "Бір таңбаны өзгертіп, ≥ 90 биттің ауысқанын көр", check: (s) => s.stats.avalanche.some((d) => d >= 90) }],
    },
    {
      id: "integrity",
      title: "Тұтастықты тексеру",
      body: "",
      focus: "hash",
      objectives: [{ id: "match", text: "Екі «жүктелген файлдың» да хэшін есептеп, түпнұсқасын тап", check: (s) => s.stats.hashes.includes(RELEASE_TEXT) && s.stats.hashes.includes(FAKE_RELEASE) }],
    },
  ],
};

export const lessonPasswords: L = {
  id: "sec-5-passwords",
  labId: "sec",
  order: 5,
  title: "Storing Passwords",
  summary: "Дерекқор ұрланды. Құпиясөздер қалай сақталғанына қарай: не болады?",
  estimatedMinutes: 20,
  steps: [
    {
      id: "plain",
      title: "Ашық мәтін",
      body: "",
      focus: "passwords",
      onEnter: [{ type: "mode/set", mode: "passwords" }, { type: "pw/storage", storage: "plain" }],
      objectives: [{ id: "leak", text: "Ашық сақталған кестеге «шабуыл» жаса", check: (s) => s.stats.crackRuns.some((r) => r.storage === "plain") }],
    },
    {
      id: "hash",
      title: "Тек хэш",
      body: "",
      focus: "passwords",
      onEnter: [{ type: "pw/storage", storage: "hash" }],
      objectives: [{ id: "dict", text: "Хэштелген кестеге сөздік шабуылын жаса", check: (s) => s.stats.crackRuns.some((r) => r.storage === "hash") }],
    },
    {
      id: "salt",
      title: "Тұз және баяу хэш",
      body: "",
      focus: "passwords",
      onEnter: [{ type: "pw/storage", storage: "salted" }],
      objectives: [
        { id: "salted", text: "Тұзды хэшке шабуыл", check: (s) => s.stats.crackRuns.some((r) => r.storage === "salted") },
        { id: "slow", text: "Баяу хэшке (1000 раунд) шабуыл: жұмыс көлемін салыстыр", check: (s) => s.stats.crackRuns.some((r) => r.storage === "slow") },
      ],
    },
  ],
};

export const lessonStrength: L = {
  id: "sec-6-strength",
  labId: "sec",
  order: 6,
  title: "Password Strength",
  summary: "Энтропия: құпиясөздің күші: оның ұзындығы мен әліпбиінің логарифмі.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "weak",
      title: "Сөздіктегі сөз",
      body: "",
      focus: "strength",
      onEnter: [{ type: "mode/set", mode: "passwords" }],
      objectives: [{ id: "dict", text: "Сөздікте бар құпиясөзді тексер", check: (s) => s.stats.strengths.some((x) => x.inDictionary) }],
    },
    {
      id: "strong",
      title: "60 бит",
      body: "",
      focus: "strength",
      objectives: [{ id: "60", text: "≥ 60 биттік құпиясөз құрастыр (сөздікте жоқ)", check: (s) => s.stats.strengths.some((x) => !x.inDictionary && x.bits >= 60) }],
    },
    {
      id: "passphrase",
      title: "Құпия сөйлем",
      body: "",
      focus: "strength",
      objectives: [{ id: "80", text: "≥ 80 биттік құпия сөйлем құрастыр", check: (s) => s.stats.strengths.some((x) => !x.inDictionary && x.bits >= 80) }],
    },
  ],
};

export const lessonRsa: L = {
  id: "sec-7-rsa",
  labId: "sec",
  order: 7,
  title: "Public-Key Cryptography",
  summary: "RSA: екі кілт: біреуі бәріне ашық, екіншісі тек сенде.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "keys",
      title: "Кілттер жұбы",
      body: "",
      focus: "rsa",
      onEnter: [{ type: "mode/set", mode: "rsa" }],
      objectives: [{ id: "keys", text: "Жарамды RSA кілттер жұбын жаса", check: (s) => s.stats.keyPairs.length > 0 }],
    },
    {
      id: "encrypt",
      title: "Шифрлау және ашу",
      body: "",
      focus: "rsa",
      objectives: [{ id: "trip", text: "Санды ашық кілтпен шифрлап, жабық кілтпен аш", check: (s) => s.stats.roundTrips.length > 0 }],
    },
    {
      id: "sign",
      title: "Цифрлық қолтаңба",
      body: "",
      focus: "rsa",
      objectives: [{ id: "sign", text: "Хабарға қол қойып, қолтаңбаны тексер", check: (s) => s.stats.signatures > 0 }],
    },
  ],
};

export const lessonInjection: L = {
  id: "sec-8-injection",
  labId: "sec",
  order: 8,
  title: "Injection & XSS",
  summary: "Ең көп тараған веб-шабуылдар: дерек код болып орындалғанда.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "sqli",
      title: "SQL injection",
      body: "",
      focus: "attack",
      onEnter: [{ type: "mode/set", mode: "attack" }, { type: "attack/param", on: false }],
      objectives: [{ id: "in", text: "Құпиясөзді білмей admin болып кір", check: (s) => s.stats.logins.some((l) => l.injected && l.as === "admin" && !l.parameterized) }],
    },
    {
      id: "fix",
      title: "Параметрлер",
      body: "",
      focus: "attack",
      objectives: [{ id: "blocked", text: "Параметрлерді қос да, сол шабуылды қайтала: кіре алмауың керек", check: (s) => s.stats.logins.some((l) => l.parameterized && !l.ok && l.quote) }],
    },
    {
      id: "xss",
      title: "XSS",
      body: "",
      focus: "attack",
      objectives: [
        { id: "raw", text: "Скрипті бар пікірді қорғаныссыз жарияла", check: (s) => s.stats.comments.some((c) => c.attack && !c.escaped) },
        { id: "escaped", text: "Экрандауды қосып, сол пікірді қайта жарияла", check: (s) => s.stats.comments.some((c) => c.attack && c.escaped) },
      ],
    },
  ],
};

export const secLessons: L[] = [
  lessonCaesar,
  lessonFrequency,
  lessonXor,
  lessonHash,
  lessonPasswords,
  lessonStrength,
  lessonRsa,
  lessonInjection,
  lessonPsetSec,
  // Middle level
  lessonModes,
  lessonHmac,
  lessonDh,
  lessonCerts,
].map((l) => withDeepDives(withContent(l, secContent[l.id] ?? secMiddleContent[l.id] ?? {}), secDeepDives[l.id] ?? {}));
