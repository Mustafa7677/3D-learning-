/**
 * Every study tool on the site, grouped by what it does for learning. The hub page shows them
 * with the learner's live numbers, so the right tool is one look away.
 */
export type BadgeKey = "cards" | "mistakes" | "recall" | "streak" | "focus" | "learn" | "plan";

export interface ToolItem {
  href: string;
  title: string;
  text: string;
  /** The finding that makes it work, in a few words. */
  why: string;
  glyph: string;
  badge?: BadgeKey;
}

export interface ToolGroup {
  id: string;
  title: string;
  lede: string;
  tone: "amber" | "teal" | "ember" | "violet" | "rose";
  items: ToolItem[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "plan",
    title: "Жоспарла және назар сал",
    lede: "Не, қашан, қаншалық: оқуды әдетке айналдыратын құралдар.",
    tone: "amber",
    items: [
      { href: "/today", title: "Бүгін", text: "Үш қадамдық күн жоспары, апта мақсаты, белсенділік және шеберлік картасы.", why: "Нақты жоспар ниетті әрекетке айналдырады", glyph: "◐", badge: "plan" },
      { href: "/focus", title: "Фокус бөлмесі", text: "Мақсат, таймер, ойлар тұрағы, бір сөйлем қорытынды және үзіліс.", why: "Бір іске терең назар ауысудан тиімді", glyph: "◎", badge: "focus" },
    ],
  },
  {
    id: "remember",
    title: "Есте сақта",
    lede: "Ұмытпау үшін: еске түсір және аралықпен қайтала.",
    tone: "teal",
    items: [
      { href: "/recall", title: "Бос парақ", text: "Тақырыпты қарамай жаз, қай ойлар келмегенін көр.", why: "Еске түсіру қайта оқудан күшті", glyph: "✎", badge: "recall" },
      { href: "/cards", title: "Карточкалар", text: "Білгенің сирек, білмегенің жиі қайтады.", why: "Аралықпен қайталау", glyph: "▤", badge: "cards" },
      { href: "/notebook", title: "Қателер дәптері", text: "Сабақтағы қате жауаптарың жиналып, қайта шығады.", why: "Қатеден үйрену ең берік", glyph: "✗", badge: "mistakes" },
    ],
  },
  {
    id: "practice",
    title: "Жаттық және сына",
    lede: "Білімді қолдануға: есеп, стратегия, араласқан сұрақтар.",
    tone: "ember",
    items: [
      { href: "/problems", title: "Есептер залы", text: "Маман фильммен шығарады, егіз есепті өзің шығарасың. Күн есебі.", why: "Шешілген мысал, сосын өзің", glyph: "♜", badge: "streak" },
      { href: "/tactics", title: "Тактика алаңы", text: "Векторлық навигатор мен функция мергені: алдымен жоспар.", why: "Жоспарлау метатанымды дамытады", glyph: "⌖" },
      { href: "/parsons", title: "Ретке келтір", text: "Араласқан код жолдарын дұрыс ретпен жина, жалғанын тап.", why: "Нөлден жазу мен оқудың арасы", glyph: "≡" },
      { href: "/ticket", title: "Емтихан билеті", text: "Әр зертханадан араласқан сұрақ, әр жауапқа сенімділік.", why: "Араластыру тәсіл таңдауды үйретеді", glyph: "▣" },
    ],
  },
  {
    id: "explore",
    title: "Зертте және ойна",
    lede: "Қызығушылықтан басталатын оқу: оқиға, ойын, сурет.",
    tone: "violet",
    items: [
      { href: "/mission", title: "Миссия", text: "Мектеп сайты неге баяулады? Өлшеп тап, түзет.", why: "Нақты мәселе ынтаны оятады", glyph: "⚑" },
      { href: "/comic", title: "Комикс: үш қол алысу", text: "Браузердің орнына сөйле: TCP, TLS, HTTP.", why: "Оқиға есте жақсы қалады", glyph: "☁" },
      { href: "/blackbox", title: "Қара жәшік", text: "Ішін көрмей сұлбасын тап: болжам және қарсы мысал.", why: "Ғалым сияқты ойлау", glyph: "■" },
      { href: "/journey", title: "Саяхат", text: "Бір басудың 185 миллисекунды: он курс бір сұраныстың ішінде.", why: "Байланыстар білімді біріктіреді", glyph: "➶" },
      { href: "/sky", title: "Білім аспаны", text: "Сабақтарың жұлдыз болып жанады.", why: "Прогресті көру ынталандырады", glyph: "✦" },
      { href: "/gazette", title: "Газет", text: "Бас мақала, сөзжұмбақ, үш дерек.", why: "Бір тақырып, бірнеше формат", glyph: "▥" },
    ],
  },
  {
    id: "learn",
    title: "Оқуды үйрен",
    lede: "Ең маңызды пән: өзің қалай оқитының.",
    tone: "rose",
    items: [{ href: "/learn", title: "Қалай оқу керек?", text: "Жеті комикс-эпизод: оқу туралы мифтер мен шындық.", why: "Тиімді тәсілді білген тиімді оқиды", glyph: "✺", badge: "learn" }],
  },
];
