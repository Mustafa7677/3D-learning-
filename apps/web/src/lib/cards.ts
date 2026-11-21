/** Есте сақтау карточкалары: twenty cards from the ten labs, scheduled by the Leitner boxes. */

export interface Card {
  id: string;
  lab: string;
  front: string;
  back: string;
}

export const CARDS: Card[] = [
  { id: "dns", lab: "web", front: "DNS", back: "Домен атын (inside.kz) IP мекенжайға айналдыратын жүйе." },
  { id: "tcp", lab: "net", front: "TCP қол алысуы", back: "SYN, SYN-ACK, ACK: үш хабармен байланыс орнату." },
  { id: "tls", lab: "web", front: "TLS", back: "Байланысты шифрлап, сервердің шын екенін сертификатпен дәлелдейтін хаттама." },
  { id: "404", lab: "web", front: "HTTP 404", back: "Сұралған бет серверде жоқ." },
  { id: "index", lab: "db", front: "Индекс", back: "Барлық жолды қарамай, керек жолды тез табуға көмектесетін құрылым." },
  { id: "tx", lab: "db", front: "Транзакция", back: "Бірнеше өзгерісті «бәрі не ештеңе» ретінде орындау: COMMIT не ROLLBACK." },
  { id: "hash", lab: "sec", front: "Хэш", back: "Кез келген деректен бекітілген ұзындықты із шығаратын функция. Кері қайтарылмайды." },
  { id: "salt", lab: "sec", front: "Тұз (salt)", back: "Хэштеу алдында құпиясөзге қосылатын кездейсоқ мән: бірдей құпиясөздердің хэші әртүрлі болады." },
  { id: "neuron", lab: "ai", front: "Нейрон", back: "Кірістерді салмақпен қосып, нәтижесін белсендіру функциясынан өткізеді." },
  { id: "lr", lab: "ai", front: "Learning rate", back: "Gradient descent-тегі қадам өлшемі. Тым үлкен болса, үйрену шашырайды." },
  { id: "overfit", lab: "ai", front: "Overfitting", back: "Модель оқу деректерін жаттап алады да, жаңа деректе нашар жұмыс істейді." },
  { id: "bigo", lab: "algo", front: "Big O", back: "Кіріс өскенде жұмыс көлемінің қалай өсетінін сипаттайды." },
  { id: "binary", lab: "algo", front: "Екілік іздеу", back: "Сұрыпталған тізімде әр қадамда іздеу аймағын екіге бөледі: O(log n)." },
  { id: "twos", lab: "arch", front: "Two's complement", back: "Теріс сандарды биттерде жазу тәсілі: биттерді аударып, 1 қосу." },
  { id: "cache", lab: "arch", front: "Процессор кэші", back: "Жиі қолданылатын деректі жылдам, кішкентай жадта процессорға жақын сақтайды." },
  { id: "container", lab: "cloud", front: "Контейнер", back: "Қолданбаны барлық тәуелділігімен бірге оқшау іске қосатын пакет." },
  { id: "canary", lab: "cloud", front: "Canary релиз", back: "Жаңа нұсқаны алдымен пайдаланушылардың аз бөлігіне шығарып, сосын ғана бәріне тарату." },
  { id: "pid", lab: "iot", front: "PID басқарушы", back: "Қатені пропорционал (P), интеграл (I) және туынды (D) бойынша түзетеді." },
  { id: "alias", lab: "iot", front: "Алиасинг", back: "Сигналды тым сирек өлшегенде жиілігі бұрмаланады. Найквист: жиіліктен кемінде екі есе жиі өлше." },
  { id: "dt", lab: "game", front: "Delta time", back: "Қозғалысты кадр жиілігіне тәуелсіз ету үшін өткен уақытқа көбейту." },
];

/** Days to wait before a card in box b (1..5) comes back. Box 1 is "again today". */
export const INTERVAL_DAYS = [0, 0, 1, 3, 7, 14];
export const BOXES = 5;
const DAY = 86_400_000;

export interface CardState {
  box: number;
  due: number;
}
export type Deck = Record<string, CardState>;

export const newDeck = (now: number): Deck => Object.fromEntries(CARDS.map((c) => [c.id, { box: 1, due: now }]));

/** Leitner: knowing moves a card one box up and pushes it out; not knowing sends it back to box 1, due now. */
export function grade(deck: Deck, id: string, knew: boolean, now: number): Deck {
  const s = deck[id] ?? { box: 1, due: now };
  const box = knew ? Math.min(BOXES, s.box + 1) : 1;
  return { ...deck, [id]: { box, due: knew ? now + INTERVAL_DAYS[box]! * DAY : now } };
}

/** Cards due now, lowest box first, then in deck order. */
export function dueCards(deck: Deck, now: number): Card[] {
  return CARDS.filter((c) => (deck[c.id]?.due ?? now) <= now).sort((a, b) => (deck[a.id]?.box ?? 1) - (deck[b.id]?.box ?? 1));
}

/** How many cards sit in each box, 1..5. */
export const boxCounts = (deck: Deck) => Array.from({ length: BOXES }, (_, i) => CARDS.filter((c) => (deck[c.id]?.box ?? 1) === i + 1).length);

/** The earliest time a card comes back, if none is due now. */
export const nextDue = (deck: Deck) => Math.min(...CARDS.map((c) => deck[c.id]?.due ?? 0));

/** Keep only known cards with sane boxes and times; add cards that are new since the save. */
export function sanitizeDeck(raw: unknown, now: number): Deck {
  const deck = newDeck(now);
  if (!raw || typeof raw !== "object") return deck;
  for (const c of CARDS) {
    const s = (raw as Record<string, unknown>)[c.id] as Partial<CardState> | undefined;
    if (!s || typeof s !== "object") continue;
    const box = Number.isInteger(s.box) && s.box! >= 1 && s.box! <= BOXES ? s.box! : 1;
    const due = typeof s.due === "number" && Number.isFinite(s.due) ? Math.min(s.due, now + 30 * DAY) : now;
    deck[c.id] = { box, due };
  }
  return deck;
}
