# INSIDE TECH — архитектура

Бұл құжат кодта не бар екенін және жаңа зертхана қалай қосылатынын сипаттайды. Толық өнім жоспары (10 зертхана, 32 апта) — [roadmap.md](./roadmap.md).

## Негізгі ереже

Визуализация, есептеу, оқыту логикасы және прогресс — бір-біріне тәуелсіз төрт қабат. Жаңа IT саласын қосу үшін бір ғана plugin және сабақтар жазылады; ядро, рендер инфрақұрылымы, прогресс және API өзгермейді.

```
apps/web  ──────────────  Next.js 16 + React Three Fiber
  │  LessonView ── useAiLabSession ──(postMessage)── ai-lab.worker
  │       │                                              │
  │  LessonEngine (main thread)                 SimulationRuntime
  │       │                                              │
  │  ProgressStore (localStorage | HTTP)          aiLabPlugin
  ▼                                                      │
apps/api  ── Fastify: /health, /v1/progress            packages/lab-ai
                                                        (MLP, datasets, lessons)
packages/sim-core       plugin контракты, runtime, replay, worker bridge
packages/lesson-engine  кезеңдер, мақсаттар, прогресс сақтау
```

## Пакеттер

### `packages/sim-core`

- **`SimulationPlugin<State, Action>`** — әр зертхананың контракты: `initialize(seed)`, `dispatch`, `step(dt)`, `snapshot/restore`, `evaluate`. Plugin — таза функциялар: I/O жоқ, `Math.random` жоқ, сағат жоқ. Барлық кездейсоқтық state ішіндегі seed-тен шығады (`Rng`, mulberry32).
- **`SimulationRuntime`** — fixed timestep (әдепкі 1/60 с, бір кадрға 8 қадамнан аспайды), әр action-ды журналға жазады, undo үшін snapshot сақтайды (200 checkpoint).
- **`replay(plugin, recording)`** — журнал мен seed бойынша кез келген сессияны бит-дәлдікпен қайта жүргізеді. Тест: `lab-ai.test.ts › replay reproduces trained weights exactly`.
- **`exposeRuntime` / `RemoteRuntime`** — runtime-ды Web Worker-ге шығарады. Әр команданың `seq` нөмірі бар, ал worker әр state-пен бірге `ack` қайтарады. Сабақ қозғалтқышы тек өз setup-әрекеттері қолданылған state-ті бағалайды. Бұл тапсырмалардың «ерте орындалуын» болдырмайды.

### `packages/lesson-engine`

- **`LessonDefinition`** — сабақ кезеңдері. Әр кезеңнің мәтіні, `objectives` (state бойынша тексеріледі), `hints`, камера фокусы (`focus`) және кезеңге кіргенде орындалатын `onEnter` әрекеттері бар.
- Мақсаттар екі түрлі. **Sticky** мақсат бір рет орындалса, орындалған күйінде қалады («байқа», «байқап көр»). **Live** мақсат кезеңді аяқтаған сәтте сақталып тұруы керек («test дәлдігі ≥ 95%»).
- **`ProgressStore`** — `KeyValueProgressStore` (localStorage), `MemoryProgressStore`, `HttpProgressStore` (`apps/api`).

### `packages/lab-ai`

- **ML-қозғалтқышы** (`ml/network.ts`) таза TypeScript-те жазылған: толық байланысқан MLP, ReLU/tanh/sigmoid/step, sigmoid-шығыспен binary cross-entropy, mini-batch SGD, L2. Backprop сандық градиентпен тексерілген. TF.js-тің орнына осы таңдалды, себебі детерминизм (replay, бағалау) және Node-та тест жүргізу маңызды. TF.js/WebGPU backend-ін кейін `trainEpoch` интерфейсінің артына қосуға болады.
- **Датасеттер**: blobs, xor, circles, moons, spiral (шуы бар, seed-пен).
- **`aiLabPlugin`** — деректер, train/test бөлу, бір нейрон, желі архитектурасы, гиперпараметрлер. Training `step()` ішінде жүреді (бір tick-те `epochsPerTick` epoch). Divergence-ті анықтайды: NaN, loss > 5 немесе loss 5 epoch бойы кездейсоқ болжамнан (ln 2) 2 есе жоғары болса. `evaluate()` overfitting, underfitting, кластардың теңгерімсіздігі және divergence-ті табады.
- **Learner stats** — оқушының әрекеттерін санайды (неше нүкте қосты, қандай learning rate-пен үйретті және т.б.). Сабақ мақсаттары соларды тексереді.
- **Тіл зертханасы** (`language/`): BPE токенизатор, PPMI + SVD embedding, self-attention (causal mask, позициялық кодтау) және интерполяцияланған триграмма LM. Бәрі ішкі қазақ корпусынан (`corpus.ts`) жүктелу кезінде детерминді түрде үйретіледі. Бұл нағыз LLM емес, алгоритмдері сол, бірақ масштабы шағын, сабақтарда да солай айтылады.
- **8 сабақ**: 1–5 және 8-сабақтар `aiLabPlugin`-де, ал 6–7-сабақтар `langLabPlugin`-де жүреді. Web-те `lib/lessons.ts` оларды бір курсқа біріктіреді. Классификатор Web Worker-де, ал тіл зертханасы негізгі ағында (MessageChannel) жұмыс істейді. Протоколы бірдей.
- **Сабақ датасеттері** бекітілген seed-пен жасалады (`dataset/generate { seed }`). Сондықтан overfitting немесе спираль тапсырмасы кез келген бастапқы салмақта орындалады. «Бот-оқушы» оны үш seed-пен тексереді.
- **Алғашқы 4 сабақ** (`lessons.ts`): Data & Dataset, Artificial Neuron, Neural Networks, Model Training. Тест ішінде «бот-оқушы» әр сабақты UI-да бар әрекеттермен ғана басынан аяғына дейін өтеді. Сондықтан ешбір мақсат орындалмайтын болып қалмайды.

## Web (`apps/web`)

- `/` — hero. Онда нақты қозғалтқыш (main thread) тірі күйде желі үйретеді. Төменде 10 зертхананың картасы.
- `/labs/ai` — сабақтар тізімі және прогресс.
- `/labs/ai/[lessonId]` — сол жақта сабақ, ортада 3D сахна, оң жақта басқару панелі. Runtime Web Worker-де жүреді.
- **3D метафора**: 1-класс нүктелері H биіктігінде, 0-класс нүктелері еденде қалқып тұрады. Модельдің ықтималдық беті P(1) биіктігі мен түсі арқылы көрсетіледі. Дұрыс модель нүктелерді «орап алады». Желі диаграммасында салмақ түсі оның таңбасын, қанықтығы шамасын білдіреді. Нүкте таңдалғанда нейрондар активациясына қарай жанады (forward propagation).
- **Камера** әр фокус аймағын экранның нақты пропорциясына сыйдырады, сондықтан тік экранды телефонда да дұрыс көрінеді.
- **Қолжетімділік**: таңдалған нүкте 2D панельде де көрсетіледі. Барлық басқару элементтері пернетақтамен жұмыс істейді. `prefers-reduced-motion` қолдауы бар. WebGL жоқ болса, fallback көрсетіледі.

## API (`apps/api`)

- Fastify 5. Анонимді оқушы қол қойылған httpOnly cookie алады (`it_lid`). Прогресс API JSON schema арқылы тексеріледі, ескірген (stale) жазбаларды қабылдамайды. CORS тек web origin-ге рұқсат етілген.
- `ProgressRepository` интерфейсі. Қазір `InMemoryProgressRepository` бар, PostgreSQL схемасы `db/migrations/0001_init.sql` файлында.
- Іске қосу: `COOKIE_SECRET=<32+ таңба> pnpm --filter @inside-tech/api dev`.

## Жаңа зертхана қосу (мысалы, Web LAB)

1. `packages/lab-web` пакетін жасап, онда `SimulationPlugin<WebLabState, WebLabAction>` жазу.
2. `LessonDefinition<WebLabState>[]` сабақтарын жазып, «бот-оқушы» тестін қосу.
3. `apps/web/src/workers/web-lab.worker.ts` файлын жасау (бір жол: `exposeRuntime(self, webLabPlugin, SEED)`).
4. Сахна компонентін жазу. Ол тек state-ті оқиды.
5. `lib/catalog.ts` ішінде статусты `open` деп белгілеу.

## Тестілер

| Деңгей | Қайда | Не тексереді |
|---|---|---|
| Unit | `packages/*/src/*.test.ts` | runtime, replay, undo, backprop, датасеттер, сабақтардың өтуге болатыны |
| API | `apps/api/src/app.test.ts` | cookie, валидация, stale write, CORS |
| E2E | `apps/web/e2e` | нақты браузер, worker training, прогрестің сақталуы |

`pnpm test` және `pnpm --filter @inside-tech/web e2e` командаларымен іске қосылады.
