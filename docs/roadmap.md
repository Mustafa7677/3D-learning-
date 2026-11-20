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

## Келесі кезеңдер

| Кезең | Мазмұны |
|---|---|
| AI LAB 5–8 | Overfitting (L2, деректің көлемі), Transformers (tokenization, attention), LLM inference (Transformers.js), Build Your AI (өз классификаторын экспорттау) |
| Платформа | PostgreSQL репозиторийі (Drizzle), OAuth/OIDC, анонимді прогресті аккаунтқа қосу, сессия recording-тарын серверге жүктеу |
| WEB LAB | `lab-web` plugin: URL → DNS → TCP → HTTP симуляциясы, DOM/CSS 3D, event loop, Monaco + sandbox iframe |
| GAME LAB | `lab-game` plugin: Rapier WASM, scene graph, game loop, ойын экспорттау |
| Learning Platform | Мұғалім панелі, тапсырма тағайындау, аналитика (replay арқылы қай жерде қателескенін көру) |
| Lesson Creator | `LessonDefinition`-ды JSON ретінде сақтау, мақсаттарды DSL арқылы сипаттау, редактор |
| Commercial | Premium/Classroom, төлем, лицензиялар, әкімші панелі |
| Production | WebGPU рендерер, LOD/instancing профильдеу, мобильді fallback, accessibility аудиті |
