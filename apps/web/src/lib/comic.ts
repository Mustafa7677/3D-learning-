/**
 * «Үш қол алысу»: a branching comic. The learner picks what the browser
 * says; a wrong pick plays out its consequence and returns to the choice.
 * Pure data and checks, no UI.
 */

export type Speaker = "browser" | "server" | "spy" | "narrator";

export interface Panel {
  who: Speaker;
  text: string;
  /** A small caption in the corner: what is on the wire. */
  wire?: string;
  /** A consequence panel is drawn as a warning. */
  bad?: boolean;
}

export interface Choice {
  text: string;
  /** The scene this choice leads to. */
  to: string;
  correct: boolean;
}

export interface Scene {
  id: string;
  /** The chapter this scene belongs to (shown as a title card). */
  chapter: string;
  panels: Panel[];
  choices?: Choice[];
  /** A consequence scene returns to this scene's choices. */
  back?: string;
  end?: boolean;
}

export const COMIC_START = "s1";

export const COMIC: Record<string, Scene> = {
  s1: {
    id: "s1",
    chapter: "I. TCP: қол алысу",
    panels: [
      { who: "narrator", text: "Браузер inside.kz-тің бетін алғысы келеді. Бірақ сервермен әлі ешқандай байланыс жоқ." },
      { who: "browser", text: "Сервермен қалай сөйлесуді бастаймын?" },
    ],
    choices: [
      { text: "SYN: «Сөйлесейік бе?»", to: "s2", correct: true },
      { text: "GET /: «Бетті бер!»", to: "x1", correct: false },
      { text: "ACK: «Түсіндім»", to: "x2", correct: false },
    ],
  },
  x1: {
    id: "x1",
    chapter: "I. TCP: қол алысу",
    back: "s1",
    panels: [
      { who: "server", text: "Сен кімсің? Арамызда байланыс жоқ. Бұл пакетті тастаймын.", wire: "GET / · жоғалды", bad: true },
      { who: "narrator", text: "TCP-де алдымен байланыс орнайды. Сұранысты содан кейін ғана жіберуге болады." },
    ],
  },
  x2: {
    id: "x2",
    chapter: "I. TCP: қол алысу",
    back: "s1",
    panels: [
      { who: "server", text: "Нені түсіндің? Мен саған әлі ештеңе айтқан жоқпын.", wire: "ACK · мағынасыз", bad: true },
      { who: "narrator", text: "ACK бір нәрсені алғанын растайды. Әзірге растайтын ештеңе жоқ." },
    ],
  },
  s2: {
    id: "s2",
    chapter: "I. TCP: қол алысу",
    panels: [
      { who: "browser", text: "Сөйлесейік бе?", wire: "SYN · 40 мс" },
      { who: "server", text: "Жарайды, дайынмын. Сен де дайынсың ба?", wire: "SYN-ACK · 40 мс" },
      { who: "browser", text: "Енді не деймін?" },
    ],
    choices: [
      { text: "ACK: «Дайынмын, бастайық»", to: "s3", correct: true },
      { text: "SYN: «Сөйлесейік бе?» (қайтадан)", to: "x3", correct: false },
    ],
  },
  x3: {
    id: "x3",
    chapter: "I. TCP: қол алысу",
    back: "s2",
    panels: [
      { who: "server", text: "Біз мұны жаңа ғана бастадық қой. Мен сенің жауабыңды күтіп тұрмын.", wire: "SYN · қайталанды", bad: true },
      { who: "narrator", text: "Үшінші қадам: SYN-ACK-ке ACK-пен жауап беру. Сонда ғана қол алысу аяқталады." },
    ],
  },
  s3: {
    id: "s3",
    chapter: "II. TLS: құпия арна",
    panels: [
      { who: "browser", text: "Дайынмын, бастайық.", wire: "ACK" },
      { who: "narrator", text: "Байланыс бар. Бірақ ол ашық: мектеп Wi-Fi-ындағы кез келген адам оны оқи алады." },
      { who: "spy", text: "Мен тыңдап тұрмын..." },
    ],
    choices: [
      { text: "ClientHello: «Алдымен шифрлайық»", to: "s4", correct: true },
      { text: "Бірден логин мен құпиясөзді жіберу", to: "x4", correct: false },
    ],
  },
  x4: {
    id: "x4",
    chapter: "II. TLS: құпия арна",
    back: "s3",
    panels: [
      { who: "browser", text: "Логин: aru, құпиясөз: qwerty123", wire: "ашық мәтін", bad: true },
      { who: "spy", text: "Рақмет! Енді бұл аккаунт менікі.", bad: true },
      { who: "narrator", text: "Шифрсыз арнада жіберілген әр нәрсені жолдағы кез келген адам оқиды. Сондықтан алдымен TLS." },
    ],
  },
  s4: {
    id: "s4",
    chapter: "II. TLS: құпия арна",
    panels: [
      { who: "browser", text: "Шифрлайық. Мен мына әдістерді білемін.", wire: "ClientHello" },
      { who: "server", text: "Мына әдісті таңдадым. Міне, менің сертификатым: мен шын inside.kz-пін.", wire: "ServerHello + сертификат" },
      { who: "browser", text: "Сертификатпен не істеймін?" },
    ],
    choices: [
      { text: "Тексеремін: оған сенімді орталық қол қойған ба, аты inside.kz ме?", to: "s5", correct: true },
      { text: "Тексермеймін: уақыт кетеді", to: "x5", correct: false },
    ],
  },
  x5: {
    id: "x5",
    chapter: "II. TLS: құпия арна",
    back: "s4",
    panels: [
      { who: "spy", text: "Ха! Шын сервер мен емес едім. Бірақ сен тексермедің, енді бәрі маған келеді.", wire: "жалған сертификат", bad: true },
      { who: "narrator", text: "Шифр «кіммен» сөйлесіп тұрғаныңды білмесең, пайдасыз. Сертификат дәл соны дәлелдейді." },
    ],
  },
  s5: {
    id: "s5",
    chapter: "III. HTTP: сұраныс",
    panels: [
      { who: "browser", text: "Қолтаңба дұрыс, аты inside.kz. Сенемін.", wire: "сертификат тексерілді" },
      { who: "spy", text: "Енді ештеңе оқи алмаймын...", wire: "шифрланған" },
      { who: "browser", text: "Ақыры бетті сұрауға болады. Қалай сұраймын?" },
    ],
    choices: [
      { text: "GET / : «Басты бетті бер»", to: "s6", correct: true },
      { text: "DELETE / : «Басты бетті өшір»", to: "x6", correct: false },
    ],
  },
  x6: {
    id: "x6",
    chapter: "III. HTTP: сұраныс",
    back: "s5",
    panels: [
      { who: "server", text: "Өшіруге рұқсатың жоқ. Әрі сен бетті алғың келген жоқ па еді?", wire: "405 Method Not Allowed", bad: true },
      { who: "narrator", text: "GET оқу үшін, DELETE өшіру үшін. Әдіс сенің ниетіңді серверге айтады." },
    ],
  },
  s6: {
    id: "s6",
    chapter: "III. HTTP: сұраныс",
    end: true,
    panels: [
      { who: "browser", text: "Басты бетті бер.", wire: "GET / HTTP/1.1" },
      { who: "server", text: "Міне, ұста.", wire: "200 OK + HTML" },
      { who: "narrator", text: "Үш қол алысу: TCP байланыс орнатты, TLS оны құпия етті, HTTP бетті сұрады. Енді браузер бетті сала алады." },
    ],
  },
};

/** Structural checks used by the tests: every link exists, every wrong turn comes back, the end is reachable. */
export function validateComic(story: Record<string, Scene>, start = COMIC_START): string[] {
  const errors: string[] = [];
  for (const s of Object.values(story)) {
    for (const c of s.choices ?? []) {
      if (!story[c.to]) errors.push(`${s.id}: no scene ${c.to}`);
      else if (!c.correct && story[c.to]!.back !== s.id) errors.push(`${s.id}: wrong choice ${c.to} does not come back`);
    }
    if (s.choices && s.choices.filter((c) => c.correct).length !== 1) errors.push(`${s.id}: needs exactly one right choice`);
    if (!s.choices && !s.back && !s.end) errors.push(`${s.id}: dead end`);
  }
  // Following only right choices from the start must reach the end.
  let at = story[start];
  const seen = new Set<string>();
  while (at && !at.end) {
    if (seen.has(at.id)) {
      errors.push("loop on the right path");
      break;
    }
    seen.add(at.id);
    at = story[at.choices?.find((c) => c.correct)?.to ?? ""];
  }
  if (!at?.end) errors.push("the end is not reachable");
  return errors;
}

/** How many decisions the right path has. */
export const decisionCount = (story: Record<string, Scene>) => Object.values(story).filter((s) => s.choices).length;
