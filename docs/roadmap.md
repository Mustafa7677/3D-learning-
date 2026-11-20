# INSIDE TECH — жол картасы

Master Plan v1.0-ге негізделген. Таңдалған жол: **A** — алдымен ядро мен AI LAB толық архитектурамен жасалады, сосын инфрақұрылым мен келесі зертханалар қосылады.

## Дайын (осы итерация)

- [x] Monorepo (pnpm workspaces), TypeScript strict, CI (typecheck, unit, build, E2E)
- [x] `sim-core`: plugin контракты, fixed timestep, журнал, undo, детерминді replay, worker bridge (`seq`/`ack`)
- [x] `lesson-engine`: кезеңдер, sticky және live мақсаттар, кеңестер, прогресс (localStorage және HTTP)
- [x] `lab-ai`: MLP + backprop, 5 датасет, AI LAB plugin, overfitting және divergence диагностикасы
- [x] AI LAB 1–4 сабақтары: Data → Neuron → Neural Network → Training
- [x] Web: басты бет (hero-да тірі training), зертхана беті, сабақ беті (3D + басқару + loss графигі)
- [x] API қаңқасы: Fastify, анонимді learner cookie, прогресс API, PostgreSQL схемасы
- [x] AI LAB 5–8: Overfitting (loss gap, көбірек дерек, L2, early stopping), Transformers (BPE, embedding, self-attention), LLM Inference (триграмма LM, temperature, top-k), Build Your AI (өз деректері, спираль, JSON экспорт)
- [x] Тіл зертханасы (`lang-lab` plugin): барлық модельдер ішкі қазақ корпусынан браузерде үйретіледі
- [x] Статикалық нұсқа және GitHub Pages деплойы
- [x] WEB LAB 1–8 (`lab-web` plugin): желі (DNS, TCP, TLS, HTTP, кэш), HTML парсер және 3D DOM, box model мен flexbox, event loop, backend маршруттары мен авторизация, шағын SQL қозғалтқышы мен индекстер, debugging сценарийі, deploy және кэш

- [x] GAME LAB 1–8 (`lab-game` plugin): scene graph және attach, ойын камерасы (perspective/ortho/follow), delta time, детерминді физика (серпімділік, импульс, tunneling/substeps), жарық пен PBR материал, «ҚАШАН → ОНДА» ережелері, жау state machine-і, деңгей редакторы
- [x] Платформа: аккаунттар (OIDC + PKCE), PostgreSQL store (нақты Postgres 16-да тексерілген), сыныптар мен мұғалім есебі, Stripe Checkout және webhook, әкімші, CSRF/rate limit; веб-те аккаунт және мұғалім беттері
- [x] CS50 деңгейіндегі мазмұн: 3 зертхананың 85 кезеңі — лекция (идея, түйсік, есептелген мысал, жиі қате) + әр кезеңде 2 сұрақ; сұрақтарға жауап бермей кезең аяқталмайды
- [x] Декларативті сабақ форматы (inside-tech/lesson@1) — Lesson Creator интерфейсінің негізі
- [x] «Тереңірек» бөлімдері: 36 математикалық қорыту мен дәлел (backprop, XOR дәлелі, η < 2/a, attention √d және O(n²), Диффи–Хеллман, B-tree биіктігі, Эйлер қатесі, импульс, BFS…), әдепкіде жиналған
- [x] «Есептеу ішінен» панелі: таңдалған нүкте үшін forward, loss, әр салмақтың градиенті және келесі SGD қадамы; backprop finite differences-пен тексерілген (gradient check)
- [x] Problem Sets (әр зертханада): спецификация + автотексеруші + алдауға қарсы тесттер — шектеулі параметр бюджеті, SQL нәтижесін эталонмен салыстыру, қорғалған API, event loop trace table, физикалық параметрлерді есептеу, BFS тексеретін деңгей

- [x] Lesson Creator (`/create`): кез келген симуляцияға кодсыз сабақ — мәтін (тірі алдын ала қарау), кезең басындағы әрекеттер, автотексерілетін тапсырмалар, тексеру сұрақтары; сақталмайтын сынақ режимі; JSON импорт/экспорт; оқушыға сілтеме (сабақ URL ішінде, серверсіз — `/play#l=…`)

- [x] ALGORITHMS LAB 1–8 + Problem Set (`lab-algo` plugin): сызықтық/екілік іздеу, bubble/selection/insertion, Big O тәжірибесі (n екі есе өскенде), merge sort, quicksort және pivot таңдау, BFS/DFS, Дейкстра; әр салыстыру мен ауыстыру 3D-де, санауыштар оқулықтағы формулалармен тексерілген

- [x] COMPUTER ARCHITECTURE LAB 1–8 + Problem Set (`lab-arch` plugin): 8 бит және hex, тасымалмен қосу, толып кету, two's complement, логикалық элементтер, жарты және толық қосындылағышты өзің құрастыру, ripple carry, fetch–decode–execute процессоры мен ассемблері, LOAD/STORE және жадтың бағасы, direct-mapped кэш және локальдық; ассемблер есептері check50 сияқты жасырын тесттермен (әрі нұсқау бюджетімен) тексеріледі

- [x] CYBERSECURITY LAB 1–8 + Problem Set (`lab-sec` plugin): қазақ әліпбиіндегі Цезарь шифры және жиілік талдауы, XOR және one-time pad, нақты SHA-256 (FIPS тест-векторлары) және лавина әсері, құпиясөз сақтау (ашық → хэш → тұз → баяу хэш) мен сөздік шабуылы, энтропия, RSA (кілт, шифрлау, қолтаңба), SQL injection және XSS; есептер: шифрды бұзу, proof of work, RSA-ны факторизациямен бұзу, injection

- [x] DATABASES LAB 1–8 + Problem Set (`lab-db` plugin): өз SQL қозғалтқышы (recursive-descent парсер; JOIN, GROUP BY/HAVING, агрегаттар, индекстер, EXPLAIN, PRIMARY/FOREIGN KEY, NOT NULL, BEGIN/COMMIT/ROLLBACK), сервердің құлауы, жоғалған жаңарту және SELECT … FOR UPDATE, mod N мен consistent hashing шардингі; нәтижелер эталон сұраныспен салыстырылады

- [x] COMPUTER NETWORKS LAB 1–8 + Problem Set (`lab-net` plugin): пакеттеу мен тақырыптар, IPv4/CIDR калькуляторы, link-state (Дейкстра) және distance-vector (Беллман–Форд) маршрутизация, сызық үзілісі мен желі бөлінуі, stop-and-wait пен жылжымалы терезе (BDP), Reno/Tahoe кептелісті басқару, NAT
- [x] CLOUD & DEVOPS LAB 1–8 + Problem Set (`lab-cloud` plugin): Docker қабаттары мен кэш реті, Kubernetes reconciliation контроллері, M/M/1 кезек теориясы мен SLO, тәуліктік автомасштабтау, CI/CD конвейері (параллель, кэш, қақпалар), canary/rolling/blue-green релиздер, «тоғыздар» мен қолжетімділік зоналары, түпкі себепті табу

## Келесі кезеңдер

| Кезең | Мазмұны |
|---|---|
| Платформа | PostgreSQL репозиторийі (Drizzle), OAuth/OIDC, анонимді прогресті аккаунтқа қосу, сессия recording-тарын серверге жүктеу |
| Learning Platform | Мұғалім панелі, тапсырма тағайындау, аналитика (replay арқылы қай жерде қателескенін көру) |
| Lesson Creator | Авторлық сабақтарды серверде сақтау және мұғалімнің сыныпқа тағайындауы |
| Commercial | Premium/Classroom, төлем, лицензиялар, әкімші панелі |
| Production | WebGPU рендерер, LOD/instancing профильдеу, мобильді fallback, accessibility аудиті |
