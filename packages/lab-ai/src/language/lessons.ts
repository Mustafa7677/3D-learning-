import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { languageContent } from "../content/language";
import type { LangLabAction, LangLabState } from "./plugin";
import { aiDeepDives } from "../content/deep";

type L = LessonDefinition<LangLabState, LangLabAction>;

export const lessonTransformers: L = {
  id: "ai-6-transformers",
  labId: "ai",
  order: 6,
  title: "Transformers",
  summary: "Мәтін қалай токенге, токен қалай векторға айналады және attention қалай жұмыс істейді.",
  estimatedMinutes: 18,
  steps: [
    {
      id: "tokens",
      title: "Токенизация",
      body:
        "Тілдік модель әріптерді де, сөздерді де тікелей көрмейді — ол токендерді көреді. Токенизатор (BPE) корпуста жиі кездесетін әріп жұптарын бірте-бірте біріктіреді: «ы»+«қ» → «ық», сосын «мыс»+«ық» → «мысық».\n\nMerge саны — сөздік өлшемі. 0 болса, әр әріп бөлек токен; көп болса, жиі сөздер бір токенге айналады. Өз сөйлеміңді жазып, merge санын өзгертіп көр.",
      focus: "tokens",
      onEnter: [{ type: "text/set", text: "мысық сүт ішеді" }, { type: "bpe/setMerges", merges: 40 }],
      objectives: [
        { id: "write", text: "Өз сөйлеміңді жаз", check: (s) => s.stats.textEdits >= 1 },
        { id: "merges", text: "Merge санының кемінде 3 түрлі мәнін байқап көр (0-ді қоса)", check: (s) => s.stats.mergeValues.length >= 3 && s.stats.mergeValues.includes(0) },
      ],
      hints: ["Корпуста жоқ сөз жазып көр: ол көп ұсақ токенге бөлінеді."],
    },
    {
      id: "embeddings",
      title: "Embedding: мағына — сан",
      body:
        "Әр сөз — 8 саннан тұратын вектор. Бұл векторлар ешкімнің қолымен жазылмаған: олар корпустан есептелді. Қатар жиі кездесетін сөздердің (мысық — сүт, компьютер — код) векторлары жақын болады.\n\n3D кеңістікте әр нүкте — бір сөз. Сөзді таңда да, оның ең жақын «көршілерін» қара.",
      focus: "embedding",
      objectives: [{ id: "words", text: "Кемінде 3 сөзді таңдап, көршілерін қара", check: (s) => s.stats.inspectedWords.length >= 3 }],
      hints: ["«мысық», «компьютер», «аспан» сөздерін салыстыр: көршілері әр тақырыптан болады."],
    },
    {
      id: "attention",
      title: "Self-attention",
      body:
        "Transformer-дің жүрегі — attention. Әр токен басқа токендерге «сұрақ» қояды: q·k скаляр көбейтіндісі ұқсастықты өлшейді, softmax оны ықтималдыққа айналдырады. Нәтижесінде әр токен өзіне маңызды сөздерден ақпарат жинайды.\n\nCausal mask GPT сияқты модельдерде қолданылады: токен тек өзінен бұрынғы сөздерді көре алады — болашақты көрмейді.",
      focus: "attention",
      onEnter: [{ type: "text/set", text: "мысық пен ит үйде сүт ішеді" }],
      objectives: [
        { id: "inspect", text: "Кемінде 2 токенді таңдап, оның назарын қара", check: (s) => s.stats.attnInspected.length >= 2 },
        { id: "causal", text: "Causal mask-ты қосып көр", check: (s) => s.stats.causalToggled },
      ],
    },
    {
      id: "sharpness",
      title: "Назардың өткірлігі",
      body:
        "Softmax алдында ұпайлар √d-ға бөлінеді — әйтпесе векторлар ұзарған сайын назар тым «өткір» болып, бір токенге ғана жабысады. Өткірлік жүгірткісі осы масштабты өзгертеді.\n\nНазардың шашыраңқылығын энтропия өлшейді: 0 — бір токенге толық назар, жоғары — бәріне біркелкі.",
      focus: "attention",
      objectives: [
        { id: "low", text: "Энтропияны 0.3-тен төмен түсір (назар бір токенде)", check: (s) => s.stats.minEntropy <= 0.3 },
        { id: "high", text: "Энтропияны 1.3-тен жоғары көтер (назар біркелкі)", check: (s) => s.stats.maxEntropy >= 1.3 },
      ],
      hints: ["Алдымен «сүт» токенін таңда. Өткірлікті 0-ге қой (біркелкі), сосын 100-ге жақындат (өткір)."],
    },
  ],
};

export const lessonLlm: L = {
  id: "ai-7-llm",
  labId: "ai",
  order: 7,
  title: "LLM Inference",
  summary: "Тілдік модель келесі токенді қалай таңдайды: ықтималдықтар, temperature, top-k.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "next",
      title: "Келесі токенді болжау",
      body:
        "Кез келген LLM бір ғана нәрсе істейді: берілген мәтіннен кейін келетін токеннің ықтималдық үлестірімін есептейді. Мұнда шағын триграмма моделі осы корпуста үйретілген; ChatGPT сияқты модельдер дәл осы сұраққа миллиардтаған параметрмен жауап береді.\n\nБастамасын (prompt) өзгертіп, ықтималдық бағандарының қалай өзгеретінін қара.",
      focus: "llm",
      onEnter: [{ type: "lm/setPrompt", prompt: "мысық" }, { type: "lm/set", params: { temperature: 1, topK: 10 } }],
      objectives: [{ id: "prompt", text: "Prompt-ты кемінде 2 рет өзгерт", check: (s) => s.stats.promptsSet >= 3 }],
    },
    {
      id: "sample",
      title: "Генерация",
      body:
        "Модель үлестірімнен бір токенді кездейсоқ таңдайды (sampling), оны мәтінге қосады және қайтадан болжайды. Мәтін токен-токенмен осылай өседі. «</s>» — сөйлемнің соңы.",
      focus: "llm",
      objectives: [{ id: "five", text: "Кемінде 5 токен генерацияла", check: (s) => s.stats.samples >= 5 }],
    },
    {
      id: "temperature",
      title: "Temperature",
      body:
        "Temperature үлестірімді өзгертеді. Төмен (0.2) болса — модель әрдайым ең ықтимал токенді таңдайды: мәтін болжамды әрі қайталанатын. Жоғары (2.0) болса — сирек токендер де таңдалады: мәтін қызық, бірақ мағынасыз болуы мүмкін.",
      focus: "llm",
      objectives: [
        { id: "cold", text: "Temperature ≤ 0.3 болғанда 3 токен генерацияла", check: (s) => s.stats.samplesLowT >= 3 },
        { id: "hot", text: "Temperature ≥ 1.5 болғанда 3 токен генерацияла", check: (s) => s.stats.samplesHighT >= 3 },
      ],
    },
    {
      id: "topk",
      title: "Top-k және greedy",
      body:
        "Top-k тек ең ықтимал k токенді қалдырып, қалғанын алып тастайды. k = 1 болса — greedy decoding: бір prompt әрдайым бір нәтиже береді. Нақты чат-боттарда temperature мен top-k (немесе top-p) бірге бапталады.",
      focus: "llm",
      objectives: [{ id: "greedy", text: "Top-k = 1 болғанда 3 токен генерацияла", check: (s) => s.stats.greedySamples >= 3 }],
    },
  ],
};

export const languageLessons: L[] = [lessonTransformers, lessonLlm].map((l) => withDeepDives(withContent(l, languageContent[l.id] ?? {}), aiDeepDives[l.id] ?? {}));
