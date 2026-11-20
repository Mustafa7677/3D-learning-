# INSIDE TECH

IT технологияларын ішінен зерттеуге арналған 3D оқу платформасы. Оқушы технологияның қалай жұмыс істейтінін көреді, параметрлерді өзгертеді, қателеседі, оны түзетеді және соңында өзі жасап шығады.

Қазір **AI LAB** зертханасының 4 сабағы жұмыс істейді. Нейрондық желі браузерде, Web Worker ішінде нақты gradient descent арқылы үйретіледі.

## Іске қосу

```bash
pnpm install
pnpm dev                 # http://localhost:3000
```

API (міндетті емес; web әзірге прогресті localStorage-те сақтайды):

```bash
COOKIE_SECRET=$(openssl rand -hex 32) pnpm --filter @inside-tech/api dev   # http://127.0.0.1:4000
```

## Тексеру

```bash
pnpm typecheck
pnpm test                                   # unit + API
pnpm --filter @inside-tech/web build
pnpm --filter @inside-tech/web e2e          # Playwright
```

## Статикалық нұсқа (сервер қажет емес)

```bash
pnpm --filter @inside-tech/web build:artifact   # apps/web/dist-artifact/
```

Бір беттік нұсқа шығады: маршрутизация hash арқылы жүреді (`#ai`, `#ai-1-data`), ал worker бөлек файлда тұрады. Worker қолжетімсіз болса, симуляция негізгі ағында жұмыс істейді. Мұны кез келген статикалық хостингке жариялауға болады.

## Құрылым

```
apps/web                Next.js 16, React Three Fiber
apps/api                Fastify 5, прогресс API, PostgreSQL схемасы
packages/sim-core       симуляция ядросы: plugin контракты, runtime, replay, worker bridge
packages/lesson-engine  сабақ кезеңдері, мақсаттар, прогресс
packages/lab-ai         ML-қозғалтқышы, AI LAB plugin, сабақтар
docs/                   архитектура және жол картасы
```

Толығырақ: [docs/architecture.md](docs/architecture.md), [docs/roadmap.md](docs/roadmap.md).
