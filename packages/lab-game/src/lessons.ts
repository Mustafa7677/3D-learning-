import { gameMiddleContent, lessonBroad, lessonFsm, lessonPathfinding, lessonPool } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { gameContent } from "./content";
import type { GameLabAction, GameLabState } from "./plugin";
import { gameDeepDives } from "./deep";
import { lessonPsetGame } from "./pset";

type L = LessonDefinition<GameLabState, GameLabAction>;

const tilesOf = (s: GameLabState, t: string) => s.game.level.join("").split(t).length - 1;

export const lessonObjects: L = {
  id: "game-1-objects",
  labId: "game",
  order: 1,
  title: "Game Objects",
  summary: "Сахна ағашы: әр объектінің өз координатасы бар және ол ата-анасына қатысты.",
  estimatedMinutes: 12,
  steps: [
    {
      id: "select",
      title: "Сахна: объектілер ағашы",
      body:
        "Ойындағы әр нәрсе: объект: орны (position), бұрылысы (rotation), өлшемі (scale). Объектілер ағаш құрайды: машинаның дөңгелектері: машинаның «балалары».\n\nСахнадағы немесе тізімдегі кемінде 3 объектіні таңда.",
      focus: "scene",
      objectives: [{ id: "three", text: "3 түрлі объектіні таңда", check: (s) => s.stats.selected.length >= 3 }],
    },
    {
      id: "parent",
      title: "Ата-ана мен бала",
      body:
        "Баланың координатасы: ата-анасына қатысты (local). Машинаны жылжытсаң, дөңгелектер онымен бірге жүреді, ал олардың local координатасы өзгермейді. Ойын қозғалтқышы әлемдік (world) координатаны тізбек бойымен есептейді.",
      focus: "scene",
      objectives: [
        { id: "move", text: "Машинаны жылжыт", check: (s) => s.stats.parentMoved },
        { id: "scale", text: "Машинаның өлшемін өзгерт: балалары да өзгереді", check: (s) => s.stats.parentScaled },
      ],
    },
    {
      id: "attach",
      title: "Объектіні жалғау",
      body: "Шамды машинаға жалға (attach): ол машинаның баласы болады. Енді машинаны жылжытсаң, шам да бірге жүреді. Қозғалтқыш шамның әлемдегі орнын сақтап, оның local координатасын қайта есептейді.",
      focus: "scene",
      objectives: [
        { id: "attach", text: "Шамды машинаға жалға", check: (s) => s.scene.entities.find((e) => e.name === "Шам")?.parent === 2 },
        { id: "move", text: "Сосын машинаны тағы жылжыт: шам бірге жүрсін", check: (s) => s.stats.movedWithAttached },
      ],
    },
  ],
};

export const lessonCamera: L = {
  id: "game-2-camera",
  labId: "game",
  order: 2,
  title: "Camera",
  summary: "Перспектива мен ортографика, FOV, ойыншының соңынан еретін камера.",
  estimatedMinutes: 10,
  steps: [
    {
      id: "game-view",
      title: "Ойынның көзі",
      body: "Редактордағы көрініс пен ойыншы көретін көрініс: екі түрлі камера. «Ойын камерасы» режиміне ауысып, FOV-ты (көру бұрышын) өзгерт: кең FOV балық көзіндей бұрмалайды, тар FOV телескоп сияқты жақындатады.",
      focus: "camera",
      onEnter: [{ type: "camera/set", patch: { view: "editor", projection: "perspective", fov: 50, follow: false } }],
      objectives: [
        { id: "view", text: "Ойын камерасына ауыс", check: (s) => s.stats.viewedGame },
        { id: "wide", text: "FOV ≥ 90°", check: (s) => s.stats.fovs.some((f) => f >= 90) },
        { id: "narrow", text: "FOV ≤ 30°", check: (s) => s.stats.fovs.some((f) => f <= 30) },
      ],
    },
    {
      id: "ortho",
      title: "Ортографиялық проекция",
      body: "Перспективада алыс заттар кішкентай көрінеді. Ортографиялық камерада өлшем қашықтыққа тәуелді емес: стратегия мен изометриялық ойындар, 2D ойындар осылай көрсетіледі.",
      focus: "camera",
      objectives: [{ id: "ortho", text: "Ойын камерасын ортографиялыққа ауыстыр", check: (s) => s.stats.usedOrtho }],
    },
    {
      id: "follow",
      title: "Соңынан еретін камера",
      body: "Машина шеңбер бойымен жүреді. Камера оның соңынан еруі үшін әр кадрда камера орнын машинаның артына (қашықтық, биіктік) қоямыз: бұл third-person камера.",
      focus: "camera",
      objectives: [{ id: "follow", text: "Ойын камерасында «соңынан еру» режимін қос", check: (s) => s.stats.followUsed }],
    },
  ],
};

export const lessonLoop: L = {
  id: "game-3-loop",
  labId: "game",
  order: 3,
  title: "Game Loop",
  summary: "Delta time: неге ойын әр компьютерде бірдей жылдамдықта жүруі керек.",
  estimatedMinutes: 10,
  steps: [
    {
      id: "bug",
      title: "Кадрға байланған қозғалыс",
      body:
        "Ойын циклі секундына көп рет қайталанады: input → update → render. Егер объектіні әр кадрда тұрақты қашықтыққа жылжытсақ, 144 Гц мониторда ол 30 Гц-тегіден 5 есе жылдам жүреді!\n\nDelta time-сыз 3 машинаны қатар жүгірт.",
      focus: "loop",
      onEnter: [{ type: "loop/set", patch: { useDeltaTime: false } }],
      objectives: [{ id: "mismatch", text: "Delta time-сыз жүгіртіп, айырманы көр", check: (s) => s.stats.loopMismatch }],
    },
    {
      id: "fix",
      title: "Delta time",
      body: "Түзету: қозғалыс = жылдамдық × dt, мұнда dt: алдыңғы кадрдан бері өткен уақыт. Кадр жиі болса, қадам кіші; сирек болса, үлкен. Нәтижесінде 3 секундтан кейін бәрі бір жерде.",
      focus: "loop",
      objectives: [{ id: "match", text: "Delta time-ды қосып, бәрі теңескенін көр", check: (s) => s.stats.loopMatch }],
    },
  ],
};

export const lessonPhysics: L = {
  id: "game-4-physics",
  labId: "game",
  order: 4,
  title: "Physics",
  summary: "Гравитация, серпімділік, соқтығысу және жылдам объектілердің қабырғадан «өтіп кетуі».",
  estimatedMinutes: 15,
  steps: [
    {
      id: "gravity",
      title: "Гравитация",
      body: "Әр физикалық қадамда: жылдамдық += гравитация × dt, орын += жылдамдық × dt. Доп таста, сосын гравитацияны Айдағыдай (1.6) етіп, айырманы көр.",
      focus: "physics",
      onEnter: [{ type: "physics/clear" }, { type: "physics/wall", on: false }, { type: "physics/set", patch: { gravity: 9.8, restitution: 0.6, substeps: 4 } }],
      objectives: [
        { id: "drop", text: "Кемінде 2 доп таста", check: (s) => s.stats.drops >= 2 },
        { id: "moon", text: "Гравитацияны ≤ 2 етіп өзгерт", check: (s) => s.stats.gravities.some((g) => g <= 2) },
      ],
    },
    {
      id: "bounce",
      title: "Серпімділік",
      body: "Доп жерге соғылғанда жылдамдығы restitution коэффициентіне көбейеді: 1: мінсіз секіру, 0: мүлдем секірмейді (пластилин).",
      focus: "physics",
      objectives: [
        { id: "bouncy", text: "Restitution ≥ 0.9", check: (s) => s.stats.restitutions.some((r) => r >= 0.9) },
        { id: "dead", text: "Restitution ≤ 0.2", check: (s) => s.stats.restitutions.some((r) => r <= 0.2) },
      ],
    },
    {
      id: "collide",
      title: "Соқтығысу",
      body: "Екі доп қабаттасса, қозғалтқыш оларды ажыратып, импульс береді: жылдамдықтар соқтығысу бағыты бойынша алмасады. Доптарды бір-бірінің үстіне таста.",
      focus: "physics",
      objectives: [{ id: "hit", text: "Доптар соқтығыссын", check: (s) => s.stats.collisions >= 1 }],
      hints: ["Бір нүктеге екі-үш доп таста."],
    },
    {
      id: "tunnel",
      title: "Tunneling",
      body:
        "Жылдам доп бір қадамда жұқа қабырғаның арғы жағына секіріп кетуі мүмкін: физика оны ешқашан қабырға ішінде «көрмейді». Қабырғаны қосып, жылдам доп лақтыр. Сосын substeps-ті көбейтіп (қадамды кішірейтіп), қайталап көр.",
      focus: "physics",
      onEnter: [{ type: "physics/clear" }, { type: "physics/wall", on: true }, { type: "physics/set", patch: { substeps: 1, gravity: 9.8 } }],
      objectives: [
        { id: "through", text: "Доп қабырғадан өтіп кетсін", check: (s) => s.stats.tunneled },
        { id: "blocked", text: "Substeps көбейтіп, сол жылдамдықта тоқтат", check: (s) => s.stats.blockedFast && s.physics.params.substeps >= 6 },
      ],
      hints: ["Жылдамдық 75, substeps 1 → өтеді. Substeps 8 → тоқтайды."],
    },
  ],
};

export const lessonGraphics: L = {
  id: "game-5-graphics",
  labId: "game",
  order: 5,
  title: "Graphics",
  summary: "Жарық түрлері, материалдар және shading: пиксель түсі қалай есептеледі.",
  estimatedMinutes: 10,
  steps: [
    {
      id: "lights",
      title: "Жарық",
      body: "Ambient: барлық жерге бірдей жарық: көлем жоқ, пішін жалпақ көрінеді. Directional: күн сияқты бір бағыттан: беттің жарыққа қараған жағы ашық. Point: шам сияқты бір нүктеден, қашықтыққа қарай әлсірейді.",
      focus: "graphics",
      onEnter: [{ type: "graphics/set", patch: { ambient: 0.4, directional: 1.2, point: 0, roughness: 0.5, metalness: 0, emissive: 0, flatShading: false } }],
      objectives: [
        { id: "ambient", text: "Тек ambient жарықты қалдыр", check: (s) => s.stats.graphicsSeen.includes("ambientOnly") },
        { id: "dir", text: "Ambient-ті сөндіріп, тек directional қалдыр", check: (s) => s.stats.graphicsSeen.includes("directionalOnly") },
        { id: "point", text: "Point жарықты қос", check: (s) => s.stats.graphicsSeen.includes("point") },
      ],
    },
    {
      id: "material",
      title: "Материал",
      body: "Roughness: бет қаншалық бұдыр: 0: айна, 1: бор. Metalness: металл ма, жоқ па. Emissive: объектінің өзі жарық шығаруы (неон, экран). Бұл параметрлерді шейдер әр пиксель үшін формуламен есептейді.",
      focus: "graphics",
      objectives: [
        { id: "shiny", text: "Жалтыр металл: metalness ≥ 0.8, roughness ≤ 0.25", check: (s) => s.stats.graphicsSeen.includes("shiny") },
        { id: "glow", text: "Жарқырау: emissive ≥ 0.8", check: (s) => s.stats.graphicsSeen.includes("glow") },
        { id: "flat", text: "Flat shading-ті қос (полигондар көрінеді)", check: (s) => s.stats.graphicsSeen.includes("flat") },
      ],
    },
  ],
};

export const lessonScripting: L = {
  id: "game-6-scripting",
  labId: "game",
  order: 6,
  title: "Scripting",
  summary: "Ойын ережелерін «ҚАШАН … ОНДА …» түрінде жаз: оқиға → әрекет.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "move",
      title: "Ойыншы қозғалмайды",
      body:
        "Ойын іске қосылды, бірақ ойыншы (көк шар) қозғалмайды: ешқандай скрипт жоқ. Ойын скриптінің негізі: оқиғалар (events) мен әрекеттер (actions).\n\nЕреже қос: «Пернелер басылғанда → ойыншыны жылжыт». Сосын «Ойынды бастау» басып, ↑ ↓ ← → немесе WASD пернелерімен жүр.",
      focus: "game",
      onEnter: [{ type: "game/reset" }],
      objectives: [{ id: "moved", text: "Ойыншыны пернелермен жылжыт", check: (s) => s.stats.movedPlayer }],
    },
    {
      id: "coins",
      title: "Тиындар",
      body: "Ойыншы тиыннан өтіп кетеді: себебі тиынға тиюді ешкім өңдемейді. Екі ереже қос: тиынға тигенде: тиынды жина және ұпай қос.",
      focus: "game",
      objectives: [
        { id: "collect", text: "Кемінде 2 тиын жина", check: (s) => s.stats.coinsCollected >= 2 },
        { id: "score", text: "Ұпай 20-дан асады", check: (s) => s.game.score >= 20 },
      ],
    },
    {
      id: "rules",
      title: "Жеңіс пен жеңіліс",
      body: "Ойынның мақсаты және қаупі болуы керек. Ережелер қос: барлық тиын жиналғанда: жеңіс; жауға тигенде: жеңіліс. Сосын ойнап көр.",
      focus: "game",
      objectives: [
        { id: "win-rule", text: "«Барлық тиын → жеңіс» ережесі бар", check: (s) => s.game.rules.some((r) => r.when === "allCoins" && r.then === "win"), sticky: false },
        { id: "lose-rule", text: "«Жауға тигенде → жеңіліс» ережесі бар", check: (s) => s.game.rules.some((r) => r.when === "touchEnemy" && r.then === "lose"), sticky: false },
        { id: "end", text: "Ойын жеңіспен немесе жеңіліспен аяқталсын", check: (s) => s.stats.wins + s.stats.losses >= 1 },
      ],
    },
  ],
};

export const lessonLogic: L = {
  id: "game-7-logic",
  labId: "game",
  order: 7,
  title: "Game Logic",
  summary: "Жаудың «миы»: күйлер машинасы: күзет, қуу, оралу.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "fsm",
      title: "Күйлер машинасы",
      body:
        "Жау (қызыл) үш күйдің бірінде: күзетте (patrol): екі нүкте арасында жүреді; қууда (chase): ойыншыға жақындағанда соңынан түседі; оралуда (return): ойыншы алыстаса, үйіне қайтады. Ауысу шарттары: қашықтық.\n\nЖауға жақында да, қашып кет: үш күйді де көр.",
      focus: "game",
      onEnter: [
        { type: "game/reset" },
        { type: "game/rule/add", when: "keys", then: "movePlayer" },
        { type: "game/rule/add", when: "touchCoin", then: "collectCoin" },
        { type: "game/rule/add", when: "touchCoin", then: "addScore" },
      ],
      objectives: [
        { id: "chase", text: "Жау қуа бастасын (chase)", check: (s) => s.stats.enemyStates.includes("chase") },
        { id: "return", text: "Жау қуудан бас тартып оралсын (return)", check: (s) => s.stats.enemyStates.includes("return") },
      ],
    },
    {
      id: "tune",
      title: "Қиындықты баптау",
      body: "Ойын қиындығы: сандар: жаудың жылдамдығы, қуу радиусы, бас тарту радиусы. Жауды «байқағыш» ет: қуу радиусы ≥ 4, жылдамдығы ойыншыдан аз болсын: әйтпесе ойын әділетсіз.",
      focus: "game",
      objectives: [
        { id: "radius", text: "Қуу радиусы ≥ 4", check: (s) => s.game.ai.chaseRadius >= 4, sticky: false },
        { id: "fair", text: "Жау ойыншыдан баяу", check: (s) => s.game.ai.enemySpeed < s.game.playerSpeed && s.game.ai.enemySpeed > 0, sticky: false },
        { id: "giveup", text: "Бас тарту радиусы қуу радиусынан үлкен", check: (s) => s.game.ai.giveUpRadius > s.game.ai.chaseRadius, sticky: false },
      ],
    },
  ],
};

export const lessonCreate: L = {
  id: "game-8-create",
  labId: "game",
  order: 8,
  title: "Create Your Game",
  summary: "Өз деңгейіңді сал, ережелерді жаз және өз ойыныңды ұтып шық.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "level",
      title: "Деңгей редакторы",
      body: "Торда тор көздерін басып, өз деңгейіңді сал: қабырға, тиын, жау, ойыншының бастау нүктесі. Жақсы деңгейде кемінде 3 тиын және кемінде 1 жау болады.",
      focus: "editor",
      onEnter: [{ type: "game/reset" }],
      objectives: [
        { id: "edit", text: "Деңгейді кемінде 5 рет өзгерт", check: (s) => s.stats.levelEdits >= 5 },
        { id: "content", text: "≥ 3 тиын және ≥ 1 жау", check: (s) => tilesOf(s, "c") >= 3 && tilesOf(s, "e") >= 1, sticky: false },
      ],
    },
    {
      id: "rules",
      title: "Ойынның ережелері",
      body: "Ойын жұмыс істеуі үшін қажетті ережелердің бәрін қос: қозғалыс, тиын жинау, ұпай, жеңіс және жеңіліс.",
      focus: "game",
      objectives: [
        {
          id: "all",
          text: "5 негізгі ереже бар",
          check: (s) =>
            [
              ["keys", "movePlayer"],
              ["touchCoin", "collectCoin"],
              ["touchCoin", "addScore"],
              ["allCoins", "win"],
              ["touchEnemy", "lose"],
            ].every(([w, t]) => s.game.rules.some((r) => r.when === w && r.then === t)),
          sticky: false,
        },
      ],
    },
    {
      id: "win",
      title: "Ұтып шық!",
      body: "Өз ойыныңды ойна. Тым қиын болса: деңгейді немесе жаудың параметрлерін өзгерт. Ойын дизайнері дәл осылай жұмыс істейді: ойна → түзет → қайта ойна.",
      focus: "game",
      objectives: [{ id: "won", text: "Өз деңгейіңде жеңіске жет", check: (s) => s.stats.wins >= 1 && s.stats.levelEdits >= 1 }],
    },
  ],
};

/** Lessons with their lecture text and concept checks merged in. */
export const gameLessons: L[] = [
  lessonObjects,
  lessonCamera,
  lessonLoop,
  lessonPhysics,
  lessonGraphics,
  lessonScripting,
  lessonLogic,
  lessonCreate,
  lessonPsetGame,
  // Middle level
  lessonPathfinding,
  lessonFsm,
  lessonBroad,
  lessonPool,
].map((l) => withDeepDives(withContent(l, gameContent[l.id] ?? gameMiddleContent[l.id] ?? {}), gameDeepDives[l.id] ?? {}));
