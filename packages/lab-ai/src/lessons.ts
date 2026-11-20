import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { classifierContent } from "./content/classifier";
import type { AiLabAction, AiLabState } from "./plugin";
import { aiDeepDives } from "./content/deep";

type L = LessonDefinition<AiLabState, AiLabAction>;

const m = (ctx: { assessment: { metrics: Record<string, number> } }, k: string) => ctx.assessment.metrics[k] ?? 0;

export const lessonData: L = {
  id: "ai-1-data",
  labId: "ai",
  order: 1,
  title: "Data & Dataset",
  summary: "Модель деректен үйренеді. Нүктелерді қосып, белгілеп, train/test-ке бөліп көр.",
  estimatedMinutes: 10,
  steps: [
    {
      id: "explore",
      title: "Деректер деген не?",
      body:
        "Әр шар — бір мысал (sample). Оның екі белгісі (feature) бар: еденде X және Z осі бойынша орны. Түсі — оның класы (label): көк = 0, қызғылт сары = 1.\n\nМашиналық оқытудың барлық сиқыры осы: модель белгілерге қарап, класты болжауды үйренеді.",
      focus: "dataset",
      onEnter: [{ type: "model/select", model: "network" }, { type: "dataset/generate", kind: "blobs", count: 120, noise: 0.2 }],
      objectives: [{ id: "inspect", text: "Кез келген нүктені басып, оның мәндерін қара", check: (s) => s.stats.inspectedPoints.length >= 1 }],
      hints: ["3D сахнадағы кез келген шарды тышқанмен бас."],
    },
    {
      id: "label",
      title: "Өз деректеріңді қос",
      body:
        "Деректерді адамдар жинайды және белгілейді. Сен де солай істе: «Нүкте қосу» режимін таңдап, еденге бас.\n\nБелгілеу қатесі (қате label) — модель қателерінің ең жиі себебі. Бір нүктенің класын ауыстырып көр.",
      focus: "dataset",
      objectives: [
        { id: "add0", text: "0-класына кемінде 3 нүкте қос", check: (s) => s.stats.userAdded[0] >= 3 },
        { id: "add1", text: "1-класына кемінде 3 нүкте қос", check: (s) => s.stats.userAdded[1] >= 3 },
        { id: "relabel", text: "Бір нүктенің класын ауыстыр", check: (s) => s.stats.relabels >= 1 },
      ],
      hints: ["Сол жақ панельдегі құралдар: «Қосу: 0», «Қосу: 1», «Класты ауыстыру», «Өшіру»."],
    },
    {
      id: "split",
      title: "Train / Test бөлу",
      body:
        "Модель train деректерінен үйренеді, ал test деректерін ешқашан көрмейді. Тек сонда біз модельдің жаңа деректерде қалай жұмыс істейтінін адал өлшей аламыз.\n\nМөлдір сақиналы нүктелер — test жиыны. Бөлу қатынасын өзгертіп, қайта араластырып көр.",
      focus: "dataset",
      objectives: [
        { id: "ratio", text: "Train үлесін 60%–85% аралығына қой", check: (s) => s.trainRatio >= 0.6 && s.trainRatio <= 0.85, sticky: false },
        { id: "shuffle", text: "Деректерді кемінде бір рет қайта араластыр", check: (s) => s.stats.reshuffles >= 1 },
        { id: "testsize", text: "Test жиынында кемінде 15 нүкте болсын", check: (_s, c) => m(c, "testCount") >= 15, sticky: false },
      ],
    },
    {
      id: "noise",
      title: "Шу және күрделілік",
      body:
        "Нақты деректер ешқашан таза болмайды. Шу (noise) кластарды бір-біріне араластырады. Ал кейбір есептерді түзу сызықпен бөлу мүмкін емес.\n\nКемінде екі түрлі датасет жүктеп, біреуінде шуды 0.5-тен асыр.",
      focus: "dataset",
      objectives: [
        { id: "kinds", text: "Кемінде 2 түрлі датасет жүкте", check: (s) => new Set(s.stats.datasetsGenerated).size >= 2 },
        { id: "noisy", text: "Шуы ≥ 0.5 датасет жүкте", check: (s) => s.datasetKind !== "custom" && s.noise >= 0.5 },
      ],
    },
  ],
};

export const lessonNeuron: L = {
  id: "ai-2-neuron",
  labId: "ai",
  order: 2,
  title: "Artificial Neuron",
  summary: "Weight, bias және activation-ды қолмен баптап, бір нейронмен деректерді бөл.",
  estimatedMinutes: 12,
  steps: [
    {
      id: "anatomy",
      title: "Нейронның құрылымы",
      body:
        "Нейрон кірістерді (x₁, x₂) салмақтарға (w₁, w₂) көбейтіп, bias (b) қосады:\n\nz = w₁·x₁ + w₂·x₂ + b\n\nСодан кейін activation функциясы z-ті шығысқа айналдырады. Сахнада салмақтың шамасы — сымның жуандығы, таңбасы — оның түсі.",
      focus: "neuron",
      onEnter: [
        { type: "dataset/generate", kind: "blobs", count: 120, noise: 0.15 },
        { type: "model/select", model: "neuron" },
        { type: "neuron/set", params: { w1: 0.5, w2: -0.5, b: 0, activation: "step" } },
      ],
      objectives: [{ id: "edit", text: "w₁, w₂ немесе b мәнін өзгерт", check: (s) => s.stats.neuronEdits >= 2 }],
    },
    {
      id: "boundary",
      title: "Шешім шекарасы",
      body:
        "z = 0 болатын сызық — шешім шекарасы (decision boundary). Оның бір жағындағы нүктелер 1 деп, екінші жағындағылары 0 деп жіктеледі.\n\nWeight шекараны бұрады, bias оны жылжытады. Екі кластың нүктелерін дұрыс бөліп шық.",
      focus: "surface",
      objectives: [
        { id: "acc90", text: "Train дәлдігін ≥ 90%-ға жеткіз", check: (_s, c) => m(c, "trainAcc") >= 0.9 },
        { id: "bias", text: "Bias мәнін 0-ден өзгерт", check: (s) => Math.abs(s.neuron.b) > 0.05 },
      ],
      hints: ["Нүктелер сол жақ төменде (0) және оң жақ жоғарыда (1). w₁ мен w₂ екеуін де оң мәнге қойып көр."],
    },
    {
      id: "activation",
      title: "Activation: step және sigmoid",
      body:
        "Step функциясы тек 0 немесе 1 береді. Sigmoid болса 0 мен 1 арасындағы ықтималдық береді. 3D бет енді баспалдақ емес, тегіс төбе болып көрінеді.\n\nДәл осы тегістік модельді градиентпен үйретуге мүмкіндік береді (4-сабақ).",
      focus: "surface",
      objectives: [
        { id: "sigmoid", text: "Activation-ды sigmoid-ке ауыстыр", check: (s) => s.neuron.activation === "sigmoid" },
        { id: "steep", text: "Салмақтарды үлкейтіп (|w| ≥ 3), бетті тіктеп көр", check: (s) => s.neuron.activation === "sigmoid" && Math.max(Math.abs(s.neuron.w1), Math.abs(s.neuron.w2)) >= 3 },
      ],
    },
    {
      id: "limits",
      title: "Бір нейронның шегі: XOR",
      body:
        "XOR деректерінде қарама-қарсы бұрыштар бір класқа жатады. Бір түзу сызық оларды ешқашан толық бөле алмайды. Қанша тырыссаң да, дәлдік шамамен 75%-дан аспайды.\n\nОсы шектеу 1969 жылы «AI қысын» тудырды. Шешімі — нейрондарды қабаттарға біріктіру (3-сабақ).",
      focus: "surface",
      onEnter: [{ type: "dataset/generate", kind: "xor", count: 160, noise: 0.1 }],
      objectives: [
        { id: "try", text: "XOR-да нейронды кемінде 5 рет баптап көр", check: (s) => s.datasetKind === "xor" && s.stats.neuronEditsOnDataset >= 5 },
        { id: "cap", text: "Дәлдік 80%-дан аспайтынын байқа", check: (s, c) => s.datasetKind === "xor" && s.stats.neuronEditsOnDataset >= 5 && m(c, "accuracy") < 0.8 },
      ],
    },
  ],
};

export const lessonNetwork: L = {
  id: "ai-3-network",
  labId: "ai",
  order: 3,
  title: "Neural Networks",
  summary: "Жасырын қабаттар қосып, forward propagation сигналдың желі арқылы қалай өтетінін көр.",
  estimatedMinutes: 12,
  steps: [
    {
      id: "layers",
      title: "Жасырын қабаттар",
      body:
        "Нейрондық желі — бірнеше нейрон қабаты. Кіріс қабаты деректерді алады, жасырын (hidden) қабаттар жаңа белгілер құрастырады, шығыс қабаты жауап береді.\n\nЖелі қазір жасырын қабатсыз. Бір жасырын қабат қос.",
      focus: "network",
      onEnter: [
        { type: "dataset/generate", kind: "xor", count: 160, noise: 0.1 },
        { type: "model/select", model: "network" },
        { type: "network/setHidden", hidden: [] },
      ],
      objectives: [{ id: "hidden1", text: "Кемінде 1 жасырын қабат қос (≥ 2 нейрон)", check: (s) => s.hidden.length >= 1 && (s.hidden[0] ?? 0) >= 2 }],
    },
    {
      id: "forward",
      title: "Forward propagation",
      body:
        "Нүктені таңда: оның x, y мәндері кіріс нейрондарына беріледі. Әр нейрон алдыңғы қабаттың шығыстарын салмақтап қосып, activation-нан өткізеді. Нейронның жарықтығы — оның активациясы.\n\nСигналдың қабаттан қабатқа өтуі forward propagation деп аталады.",
      focus: "network",
      objectives: [
        { id: "inspect3", text: "Әр түрлі 3 нүктені таңдап, активацияларды салыстыр", check: (s) => s.model === "network" && s.hidden.length >= 1 && s.stats.inspectedPoints.length >= 3 },
      ],
    },
    {
      id: "depth",
      title: "Тереңдік пен ендік",
      body:
        "Көбірек нейрон мен қабат желіге күрделірек пішіндерді үйренуге мүмкіндік береді. Бірақ параметрлер саны тез өседі, ал модель баяулап, «жаттап алуға» (overfitting) бейім болады.\n\nЕкі жасырын қабатты желі құр.",
      focus: "network",
      objectives: [{ id: "two", text: "2 немесе одан көп жасырын қабат құр", check: (s) => s.hidden.length >= 2 }],
    },
    {
      id: "activations",
      title: "Activation функциялары",
      body:
        "Activation болмаса, қанша қабат қоссаң да, желі бір ғана сызықтық функцияға айналады. ReLU, tanh, sigmoid желіге «иілуге» мүмкіндік береді.\n\nКемінде екі activation-ды байқап көр. Әр ауыстырған сайын салмақтар қайта инициализацияланады.",
      focus: "network",
      objectives: [{ id: "acts", text: "Кемінде 2 түрлі activation-ды таңда", check: (s) => s.stats.hiddenActivationsTried.length >= 2 }],
    },
  ],
};

export const lessonTraining: L = {
  id: "ai-4-training",
  labId: "ai",
  order: 4,
  title: "Model Training",
  summary: "Нақты gradient descent: learning rate, batch size және epoch-тың әсерін loss графигінен көр.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "first",
      title: "Бірінші training",
      body:
        "Training — салмақтарды автоматты түрде баптау. Әр epoch-та модель барлық train деректерін көреді, қатесін (loss) есептейді, ал backpropagation әр салмақты қатені азайтатын бағытқа сәл жылжытады.\n\n«Training бастау» батырмасын бас. Loss графигі мен 3D бетті бақыла.",
      focus: "surface",
      onEnter: [
        { type: "dataset/generate", kind: "circles", count: 240, noise: 0.15 },
        { type: "model/select", model: "network" },
        { type: "network/setActivation", activation: "tanh" },
        { type: "network/setHidden", hidden: [8, 8] },
        { type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: 300 } },
      ],
      objectives: [{ id: "e50", text: "Кемінде 50 epoch үйрет", check: (s) => s.training.epoch >= 50 }],
    },
    {
      id: "lr",
      title: "Learning rate",
      body:
        "Learning rate — әр қадамның өлшемі. Тым үлкен болса, модель минимумнан секіріп кетеді: loss секіреді немесе жарылады. Тым кіші болса, training өте баяу жүреді.\n\nЕкеуін де байқап көр. Әр тәжірибе алдында «Training-ті қайта бастау» бас.",
      focus: "charts",
      objectives: [
        { id: "high", text: "Learning rate ≥ 1 болғанда кемінде 20 epoch үйрет", check: (s) => s.stats.epochsHighLr >= 20 || (s.stats.diverged && s.hyper.learningRate >= 1) },
        { id: "low", text: "Learning rate ≤ 0.1 болғанда кемінде 20 epoch үйрет", check: (s) => s.stats.epochsLowLr >= 20 },
      ],
    },
    {
      id: "batch",
      title: "Batch size",
      body:
        "Batch size — салмақтар жаңарғанға дейін модель неше мысал көретінін анықтайды. Batch = 1 болса, жаңарту жиі, бірақ шулы. Үлкен batch болса, жаңарту тегіс, бірақ сирек.\n\nЕкеуін салыстыр: loss графигі қалай өзгереді?",
      focus: "charts",
      objectives: [
        { id: "b1", text: "Batch = 1 болғанда кемінде 10 epoch үйрет", check: (s) => s.stats.epochsBatch1 >= 10 },
        { id: "b32", text: "Batch ≥ 32 болғанда кемінде 10 epoch үйрет", check: (s) => s.stats.epochsLargeBatch >= 10 },
      ],
    },
    {
      id: "goal",
      title: "Мақсат: 95% test дәлдігі",
      body:
        "Енді бар білгеніңді қолдан: архитектураны, activation-ды, learning rate пен batch size-ты таңда. Модель test жиынында кемінде 95% дәлдікке жетсін.\n\nЕсіңде болсын: test деректері training кезінде ешқашан қолданылмайды. Бұл — адал өлшем.",
      focus: "surface",
      objectives: [
        { id: "test95", text: "Test дәлдігі ≥ 95%", check: (s, c) => s.model === "network" && m(c, "testAcc") >= 0.95 && m(c, "testCount") >= 10, sticky: false },
      ],
      hints: ["Мысалы: [8, 8] tanh, learning rate 0.3, batch 16, 150+ epoch."],
    },
  ],
};

const overfitSetup: AiLabAction[] = [
  { type: "split/setRatio", ratio: 0.4 },
  { type: "dataset/generate", kind: "circles", count: 80, noise: 1, seed: 21 },
  { type: "model/select", model: "network" },
  { type: "network/setActivation", activation: "relu" },
  { type: "network/setHidden", hidden: [16, 16, 16] },
  { type: "hyper/set", params: { learningRate: 0.1, batchSize: 4, epochLimit: 600, l2: 0, epochsPerTick: 2 } },
];

/** Test loss minus train loss: how much worse the model does on data it never saw. */
const lossGap = (c: { assessment: { metrics: Record<string, number> } }) => m(c, "testLoss") - m(c, "trainLoss");

export const lessonOverfitting: L = {
  id: "ai-5-overfitting",
  labId: "ai",
  order: 5,
  title: "Overfitting",
  summary: "Модель деректі жаттап алғанда не болатынын көр және оны екі тәсілмен емде.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "memorize",
      title: "Жаттап алу",
      body:
        "Деректер аз әрі шулы: шеңберлердің шекарасында нүктелер араласып жатыр. Ал желі үлкен — 3 қабат, әрқайсысында 16 нейрон.\n\nTraining-ті баста да, train және test дәлдігін бақыла. Желі train нүктелерінің әрқайсысының айналасына жеке «арал» салады: шуды да заңдылық деп жаттап алады. Бұл — overfitting.",
      focus: "surface",
      onEnter: overfitSetup,
      objectives: [
        { id: "train", text: "Кемінде 300 epoch үйрет", check: (s) => s.training.epoch >= 300 },
        { id: "gap", text: "Test loss train loss-тан 0.6-дан артық жоғары болғанын байқа", check: (s) => s.stats.maxLossGap >= 0.6 },
      ],
      hints: ["Бет дұрыс шеңбер емес, шиыршықталған пішін болады. Сол «аралдар» — жаттап алынған шу."],
    },
    {
      id: "more-data",
      title: "Емі 1: көбірек дерек",
      body:
        "Деректер көп болса, жеке шулы нүктелерді жаттап алу қиындайды: желі шын заңдылықты іздеуге мәжбүр.\n\n«Деректер саны» жүгірткісін кемінде 400-ге жылжыт те, қайта үйрет. Сол желі, сол параметрлер — тек дерек көп. Loss айырмасын бақыла: test loss − train loss.",
      focus: "surface",
      objectives: [
        {
          id: "big",
          text: "≥ 400 нүктемен кемінде 100 epoch үйрет: loss айырмасы 0.25-тен аз болсын",
          check: (s, c) => s.points.length >= 400 && s.training.epoch >= 100 && lossGap(c) <= 0.25,
        },
      ],
    },
    {
      id: "l2",
      title: "Емі 2: L2 регуляризация",
      body:
        "Көбірек дерек жинау әрдайым мүмкін емес. L2 регуляризация әр epoch сайын салмақтарды нөлге қарай сәл тартады: желі тек шынымен пайдалы үлкен салмақтарды сақтайды, ал шуды жаттайтын шектен тыс иілістер жоғалады.\n\nДеректер қайтадан аз. L2-ні қосып, қайта үйрет.",
      focus: "surface",
      onEnter: overfitSetup,
      objectives: [
        {
          id: "reg",
          text: "L2 ≥ 0.005 болғанда кемінде 300 epoch үйрет: loss айырмасы 0.25-тен аз болсын",
          check: (s, c) => s.hyper.l2 >= 0.005 && s.training.epoch >= 300 && lossGap(c) <= 0.25,
        },
      ],
      hints: ["L2 жүгірткісін оңға жылжыт (мысалы 0.01), «Training-ті қайта бастау», сосын «Training бастау»."],
    },
    {
      id: "early-stop",
      title: "Test loss көтерілгенде тоқта",
      body:
        "Графикке қара: training басында екі loss та төмендейді. Белгілі бір сәттен кейін train loss төмендей береді, ал test loss өсе бастайды. Дәл осы сәт — модель жалпы заңдылықты үйреніп бітіп, жаттауға көшкен жер.\n\nНақты жобаларда training осы сәтте тоқтатылады (early stopping).",
      focus: "charts",
      onEnter: overfitSetup,
      objectives: [{ id: "rise", text: "Test loss өсіп, train loss төмендеп жатқан сәтті тап", check: (s) => s.stats.sawTestLossRise }],
    },
  ],
};

export const lessonBuild: L = {
  id: "ai-8-build",
  labId: "ai",
  order: 8,
  title: "Build Your AI",
  summary: "Өз деректеріңді жина, өз модельіңді құр, ең қиын датасетті шеш және модельді экспортта.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "own-data",
      title: "Өз деректерің",
      body:
        "Сахна бос. Өз есебіңді ойлап тап: кез келген пішінде екі класс сал — сызық, бұрыш, сақина, екі арал. Сосын модель таңда да, үйрет.\n\nМашиналық оқыту жобасының бәрі осылай басталады: деректер — бірінші.",
      focus: "dataset",
      onEnter: [{ type: "dataset/clear" }, { type: "model/select", model: "network" }, { type: "network/setHidden", hidden: [8, 8] }],
      objectives: [
        { id: "add", text: "Әр класқа кемінде 10 нүкте сал", check: (s) => s.stats.userAdded[0] >= 10 && s.stats.userAdded[1] >= 10 },
        { id: "fit", text: "Өз деректеріңде train дәлдігі ≥ 90%", check: (s, c) => s.datasetKind === "custom" && s.training.epoch >= 30 && m(c, "trainAcc") >= 0.9 && m(c, "points") >= 20 },
      ],
    },
    {
      id: "spiral",
      title: "Ең қиын есеп: спираль",
      body:
        "Екі спираль бір-біріне оралған. Бір нейрон да, шағын желі де мұны шеше алмайды. Бар білгеніңді қолдан: тереңдік, activation, learning rate, epoch саны, training жылдамдығы.\n\nМақсат — test жиынында кемінде 90%.",
      focus: "surface",
      onEnter: [
        { type: "split/setRatio", ratio: 0.8 },
        { type: "dataset/generate", kind: "spiral", count: 300, noise: 0.1, seed: 5 },
        { type: "network/setHidden", hidden: [8, 8] },
      ],
      objectives: [
        { id: "spiral90", text: "Спиральда test дәлдігі ≥ 90%", check: (s, c) => s.datasetKind === "spiral" && m(c, "testAcc") >= 0.9 && m(c, "testCount") >= 30 },
      ],
      hints: ["Мысалы: 3 қабат × 16 нейрон, tanh, learning rate 0.05, batch 16, epoch шегі 2000, жылдамдық 5."],
    },
    {
      id: "export",
      title: "Модельді экспортта",
      body:
        "Үйретілген модель — жай ғана сандар: салмақтар мен bias-тар. Оларды JSON етіп сақтап, кез келген JavaScript бағдарламасында іске қоса аласың. Экспорт панелінде модельдің JSON-ы мен оны орындайтын 10 жолдық функция тұр.\n\nМодельді экспортта.",
      focus: "surface",
      objectives: [
        { id: "exported", text: "Кемінде 90% test дәлдігі бар модельді экспортта", check: (s, c) => s.stats.exports >= 1 && m(c, "testAcc") >= 0.9 },
      ],
    },
  ],
};

/** Lessons with their lecture text and concept checks merged in. */
export const aiLessons: L[] = [lessonData, lessonNeuron, lessonNetwork, lessonTraining, lessonOverfitting, lessonBuild].map((l) => withDeepDives(withContent(l, classifierContent[l.id] ?? {}), aiDeepDives[l.id] ?? {}));
