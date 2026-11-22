/**
 * The first year of a university mathematics degree, in the order the
 * authors' own course (AO17) teaches it: five subjects, 36 lessons. Lessons
 * that exist here carry their lesson id; the rest are on the roadmap.
 */

export interface MathSubject {
  slug: string;
  title: string;
  /** Where it sits in the degree. */
  term: string;
  glyph: string;
  color: string;
  lessons: { title: string; id?: string }[];
}

export const MATH_COURSE: MathSubject[] = [
  {
    slug: "linalg",
    title: "Сызықтық алгебра",
    term: "1-курс, 1-семестр",
    glyph: "⊞",
    color: "#3d5bd9",
    lessons: [
      { title: "Векторлар және олармен амалдар", id: "la-1-vectors" },
      { title: "Скаляр көбейтінді және ортогональдық", id: "la-2-dot" },
      { title: "Сызықтық теңдеулер жүйесі және Гаусс әдісі", id: "la-3-gauss" },
      { title: "Матрицалар және матрицалық амалдар", id: "la-4-matrices" },
      { title: "Кері матрица және LU жіктелуі", id: "la-5-inverse" },
      { title: "Анықтауыш", id: "la-6-determinant" },
      { title: "Векторлық кеңістік, базис және сызықтық бейнелеу", id: "la-7-basis" },
      { title: "Меншікті мәндер мен меншікті векторлар", id: "la-8-eigen" },
    ],
  },
  {
    slug: "analgeo",
    title: "Аналитикалық геометрия",
    term: "1-курс, 1-семестр",
    glyph: "◎",
    color: "#0e7490",
    lessons: [
      { title: "Жазықтықтағы координаталар" },
      { title: "Түзу және оның теңдеулері" },
      { title: "Шеңбер және эллипс" },
      { title: "Гипербола және парабола" },
      { title: "Екінші ретті қисықтар және түрлендірулер" },
      { title: "Кеңістіктегі жазықтық, түзу және беттер" },
    ],
  },
  {
    slug: "diffcalc",
    title: "Математикалық анализ I: дифференциалдық есептеу",
    term: "1-курс, 1-семестр",
    glyph: "Δ",
    color: "#15803d",
    lessons: [
      { title: "Шек ұғымы және анықтамасы" },
      { title: "Шектерді есептеу тәсілдері" },
      { title: "Үзіліссіздік" },
      { title: "Туынды анықтамасы және геометриялық мағынасы" },
      { title: "Дифференциалдау ережелері" },
      { title: "Күрделі, айқын емес және кері функция туындысы" },
      { title: "Орта мән теоремалары және Лопиталь ережесі" },
      { title: "Функцияны зерттеу және оңтайландыру" },
    ],
  },
  {
    slug: "intcalc",
    title: "Математикалық анализ II: интегралдық есептеу",
    term: "1-курс, 2-семестр",
    glyph: "∫",
    color: "#c9a24a",
    lessons: [
      { title: "Алғашқы функция және анықталмаған интеграл" },
      { title: "Анықталған интеграл және Риман қосындылары" },
      { title: "Ньютон-Лейбниц формуласы" },
      { title: "Айнымалыны ауыстыру" },
      { title: "Бөліктеп интегралдау" },
      { title: "Рационал және тригонометриялық өрнектерді интегралдау" },
      { title: "Меншіксіз интегралдар және геометриялық қолданыс" },
    ],
  },
  {
    slug: "discrete",
    title: "Дискретті математика",
    term: "1-курс, 2-семестр",
    glyph: "◇",
    color: "#a3262a",
    lessons: [
      { title: "Логика және жиындар" },
      { title: "Дәлелдеу әдістері" },
      { title: "Қатынастар және функциялар" },
      { title: "Санау әдістері және рекуррентті қатынастар" },
      { title: "Графтар теориясының негіздері" },
      { title: "Ағаштар және графтардағы алгоритмдер" },
      { title: "Булев алгебрасы және логикалық схемалар" },
    ],
  },
];

/** The subject a lesson belongs to, by its course order (1..36). */
export function subjectOfOrder(order: number): MathSubject | undefined {
  let n = 0;
  for (const s of MATH_COURSE) {
    if (order <= n + s.lessons.length) return s;
    n += s.lessons.length;
  }
  return undefined;
}
