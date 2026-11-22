/**
 * Есептер залы: hard problems taught in three moves.
 *  1. Талдау: watch an expert solve one, as a film along Pólya's route, and name its key idea.
 *  2. Стратегия: before the twin problem, choose which idea it needs.
 *  3. Өзің шығар: a twin problem (same idea, new numbers) solved step by step, each step
 *     checked; a hint costs a star.
 * Plus a problem of the day and a streak of days, so coming back is worth it.
 */
import type { SolutionFilm } from "@inside-tech/lesson-engine";

export interface TwinStep {
  prompt: string;
  answer: number;
  /** Accepted distance from the answer. */
  tol?: number;
  unit?: string;
  hint: string;
}

export interface HardProblem {
  id: string;
  labId: string;
  title: string;
  tags: string[];
  statement: string;
  film: SolutionFilm;
  /** The key idea, said in one sentence. */
  idea: string;
  /** Which idea fits the twin: the first is right; the screen shuffles them. */
  strategy: { question: string; options: string[]; why: string };
  twin: { statement: string; steps: TwinStep[]; closing: string };
}

function build(frames: { stage: 0 | 1 | 2 | 3; add: string[]; mark?: string; say: string }[]): SolutionFilm["frames"] {
  const board: string[] = [];
  return frames.map((f) => {
    board.push(...f.add);
    return { stage: f.stage, board: [...board], mark: f.mark, say: f.say };
  });
}

export const PROBLEMS: HardProblem[] = [
  {
    id: "ellipse-bed",
    labId: "math",
    title: "Бағбанның гүлзары",
    tags: ["эллипс", "Пифагор"],
    statement: "Бау ұзындығы 26 м, екі қазықтың арасы 24 м. Бау қазықтарға тұйық емес, ұштарымен байланған. Бағбан сызған эллипс гүлзардың ауданы қандай?",
    film: {
      title: "Баудан ауданға",
      frames: build([
        { stage: 0, add: ["Бау = 26 м,   қазықтар арасы = 24 м"], say: "Берілгені: бау мен қазықтар арасы. Табу керек: эллипстің ауданы, ол үшін a мен b керек." },
        { stage: 1, add: ["2a = бау,   2c = қазықтар арасы,   b² = a² − c²,   S = π·a·b"], mark: "b² = a² − c²", say: "Жоспар: бау 2a-ны, қазықтар 2c-ны береді; b-ны Пифагор табады; аудан π·a·b." },
        { stage: 2, add: ["a = 13,   c = 12"], say: "Екіге бөлеміз: a = 13 м, c = 12 м." },
        { stage: 2, add: ["b² = 169 − 144 = 25   ⇒   b = 5"], mark: "b = 5", say: "5, 12, 13: таныс Пифагор үштігі. Гүлзар өте созылған, ені бар болғаны 10 м." },
        { stage: 2, add: ["S = π · 13 · 5 ≈ 204,2 м²"], mark: "204,2", say: "Ауданы шеңбердің формуласына ұқсас, тек бір радиустың орнына екі жарты ось." },
        { stage: 3, add: ["Тексеру: e = 12/13 ≈ 0,92 < 1 ✓,   S < π·13² ✓"], mark: "✓", say: "Тексеру: эксцентриситет 1-ден кіші, аудан радиусы 13 шеңберден кіші. Мағынасы бар." },
      ]),
    },
    idea: "Бау 2a-ны, қазықтар 2c-ны береді; қалғанын Пифагор шешеді: b² = a² − c².",
    strategy: {
      question: "Бау 10 м, қазықтар арасы 6 м. Қай идеядан бастайсың?",
      options: ["Бау = 2a, қазықтар = 2c, b² = a² − c²", "Бау = шеңбердің ұзындығы, 2πr", "Аудан = бау × қазықтар арасы"],
      why: "Есеп сол: бау қашықтықтар қосындысы (2a), қазықтар фокустар (2c).",
    },
    twin: {
      statement: "Бау 10 м, қазықтардың арасы 6 м. Гүлзардың ауданын тап.",
      steps: [
        { prompt: "a неге тең?", answer: 5, unit: "м", hint: "Бау ұзындығы d₁ + d₂ = 2a." },
        { prompt: "c неге тең?", answer: 3, unit: "м", hint: "Қазықтар фокустар, олардың арасы 2c." },
        { prompt: "b неге тең?", answer: 4, unit: "м", hint: "b² = a² − c² = 25 − 9." },
        { prompt: "Аудан S = π·a·b (0,1-ге дейін)", answer: Math.PI * 20, tol: 0.1, unit: "м²", hint: "π · 5 · 4 = 20π." },
      ],
      closing: "S = 20π ≈ 62,8 м². Сен де 3, 4, 5 үштігін таптың: бағбандар оны мыңдаған жыл бұрын білген.",
    },
  },
  {
    id: "gauss-trick",
    labId: "math",
    title: "Бір амалмен бір белгісіз",
    tags: ["Гаусс әдісі", "жүйе"],
    statement: "x + y + z = 6,   x − y + z = 2,   2x + y − z = 1. Жүйені шеш.",
    film: {
      title: "Ең тиімді жою",
      frames: build([
        { stage: 0, add: ["x + y + z = 6", "x − y + z = 2", "2x + y − z = 1"], say: "Үш теңдеу, үш белгісіз. Тәртіппен жоюға болады, бірақ алдымен қарап шығайық." },
        { stage: 1, add: ["Байқау: 1-ші мен 2-ші теңдеу тек y-тің таңбасымен айырмашылық жасайды"], mark: "тек y-тің таңбасымен", say: "Жоспар: таңбасы ғана өзгеше мүшені бір амалмен жоямыз. Құрылымды көру механикалық есептен жылдам." },
        { stage: 2, add: ["(1) − (2):   2y = 4   ⇒   y = 2"], mark: "y = 2", say: "Біріншіден екіншіні аламыз: x пен z бірден жойылды." },
        { stage: 2, add: ["x + z = 4,   2x − z = −1"], say: "y = 2-ні қойсақ, екі белгісізді екі теңдеу қалды." },
        { stage: 2, add: ["Қосамыз:   3x = 3   ⇒   x = 1,   z = 3"], mark: "x = 1", say: "Енді z-тің таңбалары қарама-қарсы: қосу оны жояды." },
        { stage: 3, add: ["2·1 + 2 − 3 = 1 ✓"], mark: "✓", say: "Тексеру: соңғы теңдеуге қойдық, орындалды. Шешім (1, 2, 3)." },
      ]),
    },
    idea: "Таңбасы ғана өзгеше мүшені табып, екі теңдеуді қосу не азайту арқылы бір амалмен жою.",
    strategy: {
      question: "x + y + z = 10,   x − y + z = 4,   3x + y − z = 4. Алдымен не істейсің?",
      options: ["1-шіден 2-шіні азайтып, y-ті бірден табамын", "Үшеуін де 3-ке көбейтемін", "x-ті 1-ші теңдеуден өрнектеп, бәріне қоямын"],
      why: "Құрылым бірдей: алғашқы екі теңдеу тек y-тің таңбасымен ерекшеленеді.",
    },
    twin: {
      statement: "x + y + z = 10,   x − y + z = 4,   3x + y − z = 4. Жүйені шеш.",
      steps: [
        { prompt: "y неге тең?", answer: 3, hint: "(1) − (2): 2y = 6." },
        { prompt: "x неге тең?", answer: 2, hint: "y = 3 болса: x + z = 7 және 3x − z = 1. Қос." },
        { prompt: "z неге тең?", answer: 5, hint: "x + z = 7." },
      ],
      closing: "(2, 3, 5). Тексер: 3·2 + 3 − 5 = 4 ✓. Құрылымды көрсең, Гаусс әдісінің ұзын жолы екі қадамға қысқарады.",
    },
  },
  {
    id: "eigen-trace",
    labId: "math",
    title: "Анықтауышсыз меншікті мәндер",
    tags: ["меншікті мәндер", "із"],
    statement: "A = [[4, 1], [2, 3]]. Меншікті мәндерін тап.",
    film: {
      title: "Із бен анықтауыш",
      frames: build([
        { stage: 0, add: ["A = [[4, 1], [2, 3]]"], say: "2×2 матрица. Меншікті мәндер: det(A − λI) = 0 теңдеуінің түбірлері." },
        { stage: 1, add: ["λ² − (із)·λ + det = 0"], mark: "λ² − (із)·λ + det", say: "Жоспар: 2×2 үшін сипаттамалық теңдеуді жаттау оңай. Ізі диагональ қосындысы, анықтауыш ad − bc." },
        { stage: 2, add: ["із = 4 + 3 = 7,   det = 12 − 2 = 10"], say: "Екі сан ғана керек." },
        { stage: 2, add: ["λ² − 7λ + 10 = 0   ⇒   λ = 5,   λ = 2"], mark: "λ = 5", say: "Қосындысы 7, көбейтіндісі 10 болатын екі сан: 5 пен 2." },
        { stage: 3, add: ["5 + 2 = 7 = із ✓,   5 · 2 = 10 = det ✓"], mark: "✓", say: "Тексеру: меншікті мәндердің қосындысы ізге, көбейтіндісі анықтауышқа тең. Бұл кез келген матрицада орындалады." },
      ]),
    },
    idea: "2×2 матрицада меншікті мәндердің қосындысы ізге, көбейтіндісі анықтауышқа тең.",
    strategy: {
      question: "A = [[5, 2], [2, 2]]. Ең жылдам жол қайсы?",
      options: ["Ізі мен анықтауышын тауып, λ² − (із)λ + det = 0", "A-ны бірнеше векторға көбейтіп көру", "A⁻¹-ді табу"],
      why: "Із бен анықтауыш сипаттамалық теңдеуді бірден береді.",
    },
    twin: {
      statement: "A = [[5, 2], [2, 2]]. Меншікті мәндерін тап.",
      steps: [
        { prompt: "Ізі (диагональ қосындысы)", answer: 7, hint: "5 + 2." },
        { prompt: "Анықтауышы ad − bc", answer: 6, hint: "5·2 − 2·2." },
        { prompt: "Үлкен меншікті мән", answer: 6, hint: "Қосындысы 7, көбейтіндісі 6 екі сан." },
        { prompt: "Кіші меншікті мән", answer: 1, hint: "7 − 6." },
      ],
      closing: "λ = 6 және λ = 1. Матрица симметриялы, сондықтан меншікті векторлары перпендикуляр: (2, 1) мен (1, −2).",
    },
  },
  {
    id: "binary-search",
    labId: "algo",
    title: "Миллион кітаптың ішінен",
    tags: ["бинарлық іздеу", "логарифм"],
    statement: "Сұрыпталған тізімде 1 000 000 жазба бар. Бинарлық іздеу ең нашар жағдайда неше салыстыру жасайды?",
    film: {
      title: "Екіге бөле беру",
      frames: build([
        { stage: 0, add: ["n = 1 000 000,   әр қадамда ауқым екі есе кішірейеді"], say: "Әр салыстыру ізделетін ауқымды жартылайды. Сұрақ: неше жартылаудан кейін бір жазба қалады." },
        { stage: 1, add: ["2^k ≥ n + 1   ⇒   k = ⌈log₂(n + 1)⌉"], mark: "⌈log₂(n + 1)⌉", say: "Жоспар: k салыстыру 2^k − 1 жазбаны қамтиды. Ең кіші жеткілікті k-ны іздейміз." },
        { stage: 2, add: ["2^10 = 1024 ≈ 10³,   демек 2^20 ≈ 10⁶"], mark: "2^10 = 1024", say: "Жаттап ал: 2-нің 10-шы дәрежесі мыңға жуық. Демек миллион шамамен 2-нің 20-шы дәрежесі." },
        { stage: 2, add: ["2^20 = 1 048 576 ≥ 1 000 001   ⇒   k = 20"], mark: "k = 20", say: "2^19 = 524 288 жетпейді, 2^20 жетеді. Миллион жазбаға 20 салыстыру." },
        { stage: 3, add: ["Тізбектей іздеу: 1 000 000 салыстыру. 50 000 есе жылдам ✓"], mark: "✓", say: "Тексеру мен мағына: сұрыптау осының үшін керек. Деректер 10 есе өссе, тек 3 немесе 4 салыстыру қосылады." },
      ]),
    },
    idea: "Әр қадам ауқымды жартылайды: салыстыру саны ⌈log₂(n + 1)⌉, ал 2^10 ≈ 1000.",
    strategy: {
      question: "5 000 жазба. Салыстыру санын қалай бағалайсың?",
      options: ["n + 1-ден үлкен ең кіші 2-нің дәрежесін табамын", "5 000-ды 2-ге бөлемін", "5 000-нан квадрат түбір аламын"],
      why: "Жартылау санын логарифм береді: 2^k ≥ n + 1.",
    },
    twin: {
      statement: "Сұрыпталған тізімде 5 000 жазба. Сосын деректер 10 есе өсті: 50 000.",
      steps: [
        { prompt: "5 000 жазбаға ең нашар жағдайда неше салыстыру?", answer: 13, hint: "2^12 = 4096 жетпейді, 2^13 = 8192." },
        { prompt: "50 000 жазбаға неше?", answer: 16, hint: "2^15 = 32 768, 2^16 = 65 536." },
        { prompt: "Деректер 10 есе өскенде неше салыстыру қосылды?", answer: 3, hint: "16 − 13. Ал log₂ 10 ≈ 3,3." },
      ],
      closing: "10 есе көп деректе небәрі 3 салыстыру артық: логарифмдік алгоритмдердің күші осы. Algorithms зертханасында оны тірі көрдің.",
    },
  },
  {
    id: "birthday",
    labId: "ai",
    title: "Туған күн парадоксы",
    tags: ["ықтималдық", "толықтауыш оқиға"],
    statement: "Сыныпта 23 оқушы. Кем дегенде екеуінің туған күні бір күнге түсу ықтималдығы қандай (жылда 365 күн)?",
    film: {
      title: "Қарама-қарсысын санау",
      frames: build([
        { stage: 0, add: ["n = 23,   365 күн,   P(кем дегенде бір сәйкестік) = ?"], say: "Түйсік «аз» дейді: 23 адам 365 күннің ішінде. Бірақ жұптар саны маңызды: 23·22/2 = 253 жұп." },
        { stage: 1, add: ["P(сәйкестік) = 1 − P(бәрі әртүрлі)"], mark: "1 − P(бәрі әртүрлі)", say: "Жоспар: «кем дегенде біреу» тікелей санауға қиын. Қарама-қарсы оқиғаны, яғни бәрінің әртүрлі болуын санаймыз." },
        { stage: 2, add: ["P(бәрі әртүрлі) = 365/365 · 364/365 · … · 343/365"], say: "Бірінші адам кез келген күн; екіншісі қалған 364 күннің бірі; солай 23 адамға дейін." },
        { stage: 2, add: ["≈ 0,493"], mark: "0,493", say: "Көбейтінді жартыдан сәл кіші шығады." },
        { stage: 2, add: ["P(сәйкестік) ≈ 1 − 0,493 = 0,507 > 50%"], mark: "0,507", say: "23 адамда сәйкестік ықтималдығы 50%-дан асады. Сондықтан бұл «парадокс»." },
        { stage: 3, add: ["Тексеру: n = 366 болса, P = 1 ✓ (күн жетпейді)"], mark: "✓", say: "Шекті жағдай: 366 адамда сәйкестік міндетті, формула да 1 береді. Бұл криптографиядағы «туған күн шабуылының» негізі." },
      ]),
    },
    idea: "«Кем дегенде бір» оқиғаны тікелей емес, қарама-қарсысы арқылы санау: 1 − P(бәрі әртүрлі).",
    strategy: {
      question: "10 адамда сәйкестік ықтималдығын қалай табасың?",
      options: ["1 − (365/365 · 364/365 · … · 356/365)", "10 / 365", "10 · 9 / 365"],
      why: "Тек толықтауыш оқиға дәл береді; 10/365 сияқты бағалар жұптардың санын ескермейді.",
    },
    twin: {
      statement: "Туған күн сәйкестігі: 10 адам, сосын 30 адам. Жауапты пайызбен, 0,1-ге дейін бер.",
      steps: [
        { prompt: "10 адамда P(сәйкестік), %", answer: 11.69, tol: 0.15, unit: "%", hint: "1 − 365·364·…·356 / 365¹⁰. Есептегішпен 10 көбейткіш." },
        { prompt: "30 адамда P(сәйкестік), %", answer: 70.63, tol: 0.15, unit: "%", hint: "Сол формула, 30 көбейткіш: 365 · … · 336." },
      ],
      closing: "10 адамда шамамен 11,7%, ал 30 адамда 70,6%. Сәйкестік ықтималдығы адамдар санымен емес, жұптар санымен өседі.",
    },
  },
  {
    id: "bdp",
    labId: "net",
    title: "Кең арна, баяу жүктеу",
    tags: ["TCP терезесі", "BDP"],
    statement: "Арна 100 Мбит/с, RTT 40 мс. TCP терезесі 64 КБ (1 КБ = 1000 байт). Бір байланыстың ең үлкен жылдамдығы қандай?",
    film: {
      title: "Терезе мен құбыр",
      frames: build([
        { stage: 0, add: ["Арна 100 Мбит/с,   RTT = 40 мс,   терезе 64 КБ"], say: "Түйсік «100 Мбит/с» дейді. Бірақ TCP растау келмейінше терезеден артық жібермейді." },
        { stage: 1, add: ["жылдамдық ≤ терезе / RTT"], mark: "терезе / RTT", say: "Жоспар: бір RTT ішінде ең көбі бір терезе жіберіледі. Сосын арнаның өз шегімен салыстырамыз." },
        { stage: 2, add: ["64 000 байт · 8 = 512 000 бит"], say: "Бірліктерді біріздендіреміз: байтты битке." },
        { stage: 2, add: ["512 000 бит / 0,04 с = 12,8 Мбит/с"], mark: "12,8 Мбит/с", say: "Арнаның сегізден бірі ғана. Қалған уақытта жіберуші растауды күтіп тұр." },
        { stage: 2, add: ["BDP = 100 Мбит/с · 0,04 с = 4 Мбит = 500 КБ"], mark: "500 КБ", say: "Құбырды толтыру үшін терезе өткізу қабілеті мен кідірістің көбейтіндісіне, 500 КБ-қа тең болуы керек." },
        { stage: 3, add: ["Тексеру: 500 КБ / 0,04 с = 100 Мбит/с ✓"], mark: "✓", say: "Тексеру: осындай терезе дәл арнаның жылдамдығын береді. Сондықтан TCP терезені масштабтау опциясы бар." },
      ]),
    },
    idea: "Бір RTT-та бір терезе: жылдамдық ≤ терезе / RTT; құбырды толтыруға терезе BDP-ге тең болуы керек.",
    strategy: {
      question: "50 Мбит/с, RTT 80 мс, терезе 64 КБ. Неден бастайсың?",
      options: ["Терезе / RTT мен BDP-ні есептеймін", "Арна жылдамдығын 8-ге бөлемін", "RTT-ны арна жылдамдығына бөлемін"],
      why: "Шек терезе мен кідірістен шығады, арнаның өзінен емес.",
    },
    twin: {
      statement: "Арна 50 Мбит/с, RTT 80 мс, терезе 64 КБ (1 КБ = 1000 байт).",
      steps: [
        { prompt: "Бір байланыстың ең үлкен жылдамдығы, Мбит/с", answer: 6.4, tol: 0.05, unit: "Мбит/с", hint: "512 000 бит / 0,08 с." },
        { prompt: "BDP, КБ", answer: 500, unit: "КБ", hint: "50 000 000 бит/с · 0,08 с = 4 000 000 бит; 8-ге бөл, сосын 1000-ға." },
        { prompt: "Арнаны толтыру үшін неше параллель байланыс керек?", answer: 8, hint: "50 / 6,4 ≈ 7,8, ал байланыс бүтін сан." },
      ],
      closing: "Бір байланыс 6,4 Мбит/с, BDP 500 КБ, арнаны толтыруға 8 байланыс керек. Жүктеу менеджерлері файлды бөліктерге бөліп, бірнеше байланыспен тартатыны сондықтан.",
    },
  },
  {
    id: "passwords",
    labId: "sec",
    title: "Ұзын ба, күрделі ме?",
    tags: ["энтропия", "логарифм"],
    statement: "Құпия сөз 62 таңбадан (a-z, A-Z, 0-9) кездейсоқ 8 таңба. Оның энтропиясы неше бит? Секундына 10¹⁰ болжам жасайтын шабуылшы барлығын қанша сағатта тексереді?",
    film: {
      title: "Биттермен санау",
      frames: build([
        { stage: 0, add: ["Әліпби 62,   ұзындығы 8,   10¹⁰ болжам/с"], say: "Сұрақ: мүмкін құпия сөздер саны және оларды тексеру уақыты." },
        { stage: 1, add: ["нұсқалар = 62⁸,   энтропия = 8 · log₂ 62"], mark: "8 · log₂ 62", say: "Жоспар: әр таңба log₂ 62 бит береді, таңбалар тәуелсіз, сондықтан биттер қосылады." },
        { stage: 2, add: ["log₂ 62 ≈ 5,95   ⇒   8 · 5,95 ≈ 47,6 бит"], mark: "47,6 бит", say: "Бір таңба шамамен 6 бит. Сегіз таңба 47,6 бит." },
        { stage: 2, add: ["62⁸ ≈ 2,18 · 10¹⁴   ⇒   2,18 · 10¹⁴ / 10¹⁰ ≈ 21 800 с ≈ 6 сағ"], mark: "6 сағ", say: "Барлығын тексеруге 6 сағатқа жуық. Бұл күшті шабуылшыға бір түн ғана." },
        { stage: 3, add: ["Тексеру: 2^47,6 ≈ 2,18 · 10¹⁴ ✓"], mark: "✓", say: "Тексеру: биттер мен нұсқалар саны бір нәрсе. Ұзындық қосу әр таңбаға 6 бит, ал күрделілік тек log₂ өзгертеді." },
      ]),
    },
    idea: "Энтропия = ұзындық · log₂(әліпби): ұзындық сызықтық қосады, әліпби тек логарифм арқылы.",
    strategy: {
      question: "7776 сөздік тізімнен кездейсоқ 4 сөз. Энтропияны қалай санайсың?",
      options: ["4 · log₂ 7776, сөз бір «таңба» сияқты", "Сөздердегі әріптер санын 62-ге көбейтемін", "7776-ны 4-ке бөлемін"],
      why: "Әр сөз 7776 нұсқаның бірі: оның өзі бір таңба, әліпбиі 7776.",
    },
    twin: {
      statement: "7776 сөзден тұратын тізім (Diceware). Құпия сөз кездейсоқ 4 сөз. Оны 12 кіші латын әріптен тұратын құпия сөзбен салыстыр.",
      steps: [
        { prompt: "Бір сөздің энтропиясы, бит (0,1-ге дейін)", answer: Math.log2(7776), tol: 0.06, unit: "бит", hint: "7776 = 6⁵, log₂ 6 ≈ 2,585." },
        { prompt: "4 сөз, бит", answer: 4 * Math.log2(7776), tol: 0.1, unit: "бит", hint: "4 · 12,92." },
        { prompt: "12 кіші әріп (әліпби 26), бит", answer: 12 * Math.log2(26), tol: 0.1, unit: "бит", hint: "12 · log₂ 26, ал log₂ 26 ≈ 4,70." },
      ],
      closing: "4 сөз ≈ 51,7 бит, 12 кіші әріп ≈ 56,4 бит. Екеуі де 8 таңбалы «күрделі» құпия сөзден (47,6) күшті, ал сөздерді есте сақтау оңай.",
    },
  },
];

// ---------------------------------------------------------------- checking

/** Reads "62,8", "62.8", "1/7" or "-3". */
export function readNumber(text: string): number | null {
  const t = text.trim().replace(/\s+/g, "").replace(",", ".").replace("−", "-");
  if (!t) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function checkStep(step: TwinStep, text: string): "right" | "wrong" | "empty" {
  const n = readNumber(text);
  if (n === null) return "empty";
  return Math.abs(n - step.answer) <= (step.tol ?? 1e-9) ? "right" : "wrong";
}

/** 3 stars without hints and with the right strategy; each hint or a wrong strategy costs one. */
export function problemStars(hints: number, strategyMisses: number): number {
  return Math.max(1, 3 - hints - Math.min(strategyMisses, 1));
}
export const XP_PER_STAR = 20;

// ---------------------------------------------------------------- the day, the streak

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The problem of the day: the same for everyone on a date, a different one the next day. */
export function dailyProblem(d: Date): HardProblem {
  const start = Date.UTC(2026, 0, 1);
  const days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000);
  return PROBLEMS[((days % PROBLEMS.length) + PROBLEMS.length) % PROBLEMS.length]!;
}

export interface Streak {
  /** Days on which a problem was solved, newest last. */
  days: string[];
}

function prevDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y!, m! - 1, d! - 1));
}

/** Days in a row ending today or yesterday (a streak survives until a day is missed). */
export function streakLength(s: Streak, today: Date): number {
  const set = new Set(s.days);
  let k = dayKey(today);
  if (!set.has(k)) k = prevDay(k);
  let n = 0;
  while (set.has(k)) {
    n++;
    k = prevDay(k);
  }
  return n;
}

export function bestStreak(s: Streak): number {
  const days = [...new Set(s.days)].sort();
  let best = 0;
  let run = 0;
  let last = "";
  for (const d of days) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return best;
}

export function markSolvedDay(s: Streak, today: Date): Streak {
  const k = dayKey(today);
  return s.days.includes(k) ? s : { days: [...s.days, k].slice(-400) };
}

/** The last seven days, oldest first, each with whether a problem was solved. */
export function week(s: Streak, today: Date): { key: string; solved: boolean; today: boolean }[] {
  const set = new Set(s.days);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    out.push({ key, solved: set.has(key), today: i === 0 });
  }
  return out;
}

// ---------------------------------------------------------------- storage

const SAVE = "inside-tech:problems";
export interface ProblemsSave {
  stars: Record<string, number>;
  streak: Streak;
}

export function loadProblems(): ProblemsSave {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE) ?? "{}");
    const stars = v && typeof v.stars === "object" && v.stars ? (Object.fromEntries(Object.entries(v.stars).filter(([k, n]) => PROBLEMS.some((p) => p.id === k) && typeof n === "number" && n >= 1 && n <= 3)) as Record<string, number>) : {};
    const days = Array.isArray(v?.streak?.days) ? (v.streak.days as unknown[]).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    return { stars, streak: { days } };
  } catch {
    return { stars: {}, streak: { days: [] } };
  }
}

export function saveProblems(p: ProblemsSave) {
  try {
    localStorage.setItem(SAVE, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export const problemsXp = (p: ProblemsSave) => Object.values(p.stars).reduce((a, b) => a + b, 0) * XP_PER_STAR;
