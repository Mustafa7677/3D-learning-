import type { LessonDefinition } from "@inside-tech/lesson-engine";
import { parameterCount, type Network } from "./ml/network";
import type { AiLabAction, AiLabState } from "./plugin";

type L = LessonDefinition<AiLabState, AiLabAction>;
type Ctx = { assessment: { metrics: Record<string, number> } };

const m = (c: Ctx, k: string) => c.assessment.metrics[k] ?? 0;
const params = (net: Network) => parameterCount(net);

/** The task's fixed data must be untouched: same generator, seed, size and a real test set. */
const onTask = (s: AiLabState, c: Ctx, kind: string, seed: number, count: number) =>
  s.model === "network" && s.datasetKind === kind && s.dataSeed === seed && s.points.length === count && m(c, "testCount") >= count * 0.2 - 0.5;

/**
 * Problem set: the learner gets a specification, constraints and an autograder,
 * not instructions. Each problem has a fixed dataset so grading is fair.
 */
export const lessonPsetAi: L = {
  id: "ai-9-pset",
  labId: "ai",
  order: 9,
  title: "Problem Set: шектеулі бюджет",
  summary: "Үш есеп, үш шектеу. Нұсқаулық жоқ — тек спецификация және автотексеруші.",
  estimatedMinutes: 40,
  steps: [
    {
      id: "xor",
      title: "1-есеп: XOR, ≤ 17 параметр",
      focus: "surface",
      onEnter: [
        { type: "split/setRatio", ratio: 0.8 },
        { type: "dataset/generate", kind: "xor", count: 200, noise: 0.1, seed: 3 },
        { type: "model/select", model: "network" },
        { type: "network/setHidden", hidden: [16, 16] },
      ],
      body: `## Спецификация
Деректер: XOR, 200 нүкте (өзгертуге болмайды). Модель: нейрондық желі.

**Талап:** test дәлдігі ≥ 95%.
**Шектеу:** параметрлер саны ≤ 17.

Қазір желіде 16 + 16 нейрон — 337 параметр. Ол есепті шешеді, бірақ бюджеттен 20 есе асып тұр.

## Автотексеруші не тексереді
- деректер жиыны тапсырмадағыдай (түрі, seed, саны, test жиыны ≥ 20%)
- \`parameterCount(network) ≤ 17\`
- кез келген сәтте test дәлдігі ≥ 95%

## Ойлану үшін
Бір жасырын қабатта k нейрон болса, параметрлер саны: 2k + k (жасырын) + k + 1 (шығыс) = 4k + 1. Бюджетке қанша k сыяды?

XOR-ды шешу үшін теорияда **2** жасырын нейрон жеткілікті (бірі «OR», бірі «AND»). Бірақ тәжірибеде 2 нейронмен training жиі **жергілікті минимумда** (≈ 85%) тұрып қалады. Сондықтан бюджет кішкене қор береді.

> 💡 Тұрып қалсаң — «Training-ті қайта бастау» (жаңа кездейсоқ салмақтар) немесе басқа activation байқап көр.

## Енді сен
Архитектураны бюджетке сыйғыз да, үйрет.`,
      objectives: [
        { id: "budget", text: "Параметрлер ≤ 17", check: (s) => s.model === "network" && params(s.network) <= 17, sticky: false },
        { id: "acc", text: "XOR-да test дәлдігі ≥ 95% (бюджет ішінде)", check: (s, c) => onTask(s, c, "xor", 3, 200) && params(s.network) <= 17 && m(c, "testAcc") >= 0.95 },
      ],
      hints: ["4 жасырын нейрон: 4·4 + 1 = 17. tanh, learning rate 0.3, batch 16, 300 epoch."],
      quiz: [
        {
          id: "count",
          question: "2 кіріс → 4 жасырын → 1 шығыс желіде неше параметр бар?",
          options: ["9", "12", "17", "24"],
          answer: 2,
          explain: "Жасырын: 4×2 салмақ + 4 bias = 12. Шығыс: 1×4 салмақ + 1 bias = 5. Барлығы 17.",
          wrongHint: "Bias-тарды да санауды ұмытпа: әр нейронға біреуден.",
        },
        {
          id: "minimum",
          question: "Теорияда 2 нейрон XOR-ды шеше алады. Ендеше training неге кейде 85%-да тұрып қалады?",
          options: [
            "Gradient descent жергілікті минимумға түсуі мүмкін: ол тек еңісті көреді, ең жақсы шешімді емес",
            "2 нейронмен XOR математикалық тұрғыда мүмкін емес",
            "Learning rate неғұрлым үлкен болса, соғұрлым дәл",
          ],
          answer: 0,
          explain: "Loss беті ойлы-қырлы. Gradient descent — жергілікті әдіс: ол «төменге» жүреді, бірақ ең терең шұңқырға апаратынына кепілдік жоқ. Параметр көп болса, бет «тегістеледі» — сондықтан үлкен желілер оңай үйренеді.",
        },
      ],
    },
    {
      id: "circles",
      title: "2-есеп: шеңбер, минимум нейрон",
      focus: "surface",
      onEnter: [
        { type: "split/setRatio", ratio: 0.8 },
        { type: "dataset/generate", kind: "circles", count: 300, noise: 0.1, seed: 4 },
        { type: "model/select", model: "network" },
        { type: "network/setHidden", hidden: [8] },
      ],
      body: `## Спецификация
Деректер: шеңберлер, 300 нүкте. Бір класс — ортадағы диск, екіншісі — оны қоршаған сақина.

**Талап:** test дәлдігі ≥ 95%.
**Шектеу:** параметрлер саны ≤ 13, яғни ең көбі **3** жасырын нейрон.

## Геометриялық ой
Әр жасырын нейрон — жазықтықтағы бір **түзу** (z = 0 шекарасы). Шығыс нейрон осы түзулердің «жақтарын» біріктіреді.
- 1 түзу жазықтықты екіге бөледі — дискіні қоршай алмайды.
- 2 түзу — жолақ не бұрыш; бірақ **шектелген** аймақ (жан-жағынан жабық) жасай алмайды.
- 3 түзу — **үшбұрыш**: жабық аймақтың ең қарапайымы. Диск үшбұрышқа сыяды.

Яғни 3 — ақылға қонымды минимум. Үйреткен соң 3D бетке қара: шекарада үш түзу «бұрыш» көрінеді.

## Автотексеруші
- деректер тапсырмадағыдай, параметрлер ≤ 13, test дәлдігі ≥ 95%

## Енді сен
Ең кіші желіні тап да, үйрет.`,
      objectives: [
        { id: "budget", text: "Параметрлер ≤ 13", check: (s) => s.model === "network" && params(s.network) <= 13, sticky: false },
        { id: "acc", text: "Шеңберлерде test дәлдігі ≥ 95% (бюджет ішінде)", check: (s, c) => onTask(s, c, "circles", 4, 300) && params(s.network) <= 13 && m(c, "testAcc") >= 0.95 },
      ],
      hints: ["1 қабат, 3 нейрон, tanh, learning rate 0.3, batch 16, 400 epoch."],
      quiz: [
        {
          id: "lines",
          question: "Неге бір жасырын қабаттағы 2 нейрон дискіні жеке бөліп ала алмайды?",
          options: [
            "Екі түзу жабық (шектелген) аймақ құра алмайды — кем дегенде 3 түзу керек",
            "Себебі tanh тым баяу",
            "Себебі шығыс нейрон сызықтық емес",
          ],
          answer: 0,
          explain: "Екі түзудің кез келген «жақтар» комбинациясы — жарты жазықтық, жолақ немесе шексіз бұрыш. Жабық аймақ үшін кемінде үшбұрыш, яғни 3 түзу керек.",
        },
        {
          id: "budget",
          question: "Неге шағын модельге ұмтыламыз, егер үлкені де шешсе?",
          options: [
            "Аз параметр — жылдам болжам, аз жад және overfitting қаупі төмен",
            "Шағын модель әрдайым дәлірек",
            "Үлкен модельді үйрету мүмкін емес",
          ],
          answer: 0,
          explain: "Телефонда, браузерде, микроконтроллерде әр параметр — жад пен батарея. Және параметр аз болса, модель деректі «жаттап алуы» қиынырақ.",
        },
      ],
    },
    {
      id: "spiral",
      title: "3-есеп: спираль ≥ 95%",
      focus: "surface",
      onEnter: [
        { type: "split/setRatio", ratio: 0.8 },
        { type: "dataset/generate", kind: "spiral", count: 300, noise: 0.1, seed: 5 },
        { type: "model/select", model: "network" },
        { type: "network/setHidden", hidden: [8, 8] },
      ],
      body: `## Спецификация
Деректер: екі оралған спираль, 300 нүкте. 8-сабақта 90% жеткілікті болған. Енді — **кәсіби деңгей**.

**Талап:** test дәлдігі ≥ 95%.
**Шектеу:** параметрлер ≤ 700.

## Не білесің
- Спираль — бірнеше рет оралған шекара. Әр орам желіден жаңа «иілу» талап етеді: **тереңдік** мұнда ендіден пайдалырақ.
- ReLU терең желілерде градиентті жақсы өткізеді; tanh тегіс шекара береді.
- Learning rate тым үлкен — loss тербеледі; тым кішкене — 2000 epoch жетпейді.
- Batch кішкене — шулы, бірақ жиі қадам.

## Тәжірибе жүргізу тәртібі (ғалымша)
1. Бір нәрсені ғана өзгерт.
2. Нәтижені жаз (test %, epoch).
3. Ең жақсысын қалдырып, келесі параметрге көш.

Параметрлерді санау: 2 → a → b → c → 1 желіде 2a + a + ab + b + bc + c + c + 1.

## Енді сен
Архитектура мен гиперпараметрлерді таңда, test ≥ 95%-ға жет.`,
      objectives: [
        { id: "budget", text: "Параметрлер ≤ 700", check: (s) => s.model === "network" && params(s.network) <= 700, sticky: false },
        { id: "acc", text: "Спиральда test дәлдігі ≥ 95% (бюджет ішінде)", check: (s, c) => onTask(s, c, "spiral", 5, 300) && params(s.network) <= 700 && m(c, "testAcc") >= 0.95 },
      ],
      hints: ["3 қабат × 16 нейрон (609 параметр), ReLU, learning rate 0.05, batch 16, epoch шегі 2000."],
      quiz: [
        {
          id: "count",
          question: "2 → 16 → 16 → 16 → 1 желіде неше параметр бар?",
          options: ["337", "609", "784", "1024"],
          answer: 1,
          explain: "48 (2·16+16) + 272 (16·16+16) + 272 + 17 (16·1+1) = 609.",
          wrongHint: "Әр қабатқа: (кірістер × нейрондар) + нейрондар.",
        },
        {
          id: "method",
          question: "Екі гиперпараметрді бір уақытта өзгерттің, нәтиже жақсарды. Не білдің?",
          options: [
            "Қайсысы көмектескенін білмейміз — тәжірибені бір өзгеріспен қайтала",
            "Екеуі де көмектесті",
            "Learning rate әрдайым маңыздырақ",
          ],
          answer: 0,
          explain: "Екі айнымалы бірге өзгерсе, әсерлерін ажырату мүмкін емес (біреуі көмектесіп, екіншісі зиян келтірген болуы да мүмкін). Ғылыми тәжірибенің негізгі ережесі — бір уақытта бір айнымалы.",
        },
      ],
    },
  ],
};
