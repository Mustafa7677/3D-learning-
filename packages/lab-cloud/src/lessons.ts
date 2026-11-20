import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { cloudContent } from "./content";
import { BAD_ORDER, ROOT_CAUSE } from "./core";
import { cloudDeepDives } from "./deep";
import type { CloudLabAction, CloudLabState } from "./plugin";
import { lessonPsetCloud } from "./pset";

type L = LessonDefinition<CloudLabState, CloudLabAction>;

export const lessonContainers: L = {
  id: "cloud-1-containers",
  labId: "cloud",
  order: 1,
  title: "Containers",
  summary: "Образ қабаттардан тұрады. Қабаттардың реті жинау уақытын бірнеше есе өзгертеді.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "build",
      title: "Қабаттар мен кэш",
      body: "",
      focus: "image",
      onEnter: [{ type: "mode/set", mode: "image" }, { type: "image/order", order: BAD_ORDER }],
      objectives: [{ id: "slow", text: "Кодты өзгертіп, образды қайта жина — неше секунд?", check: (s) => s.stats.imageBuilds.some((b) => b.change === "src" && b.valid && b.seconds > 60) }],
    },
    {
      id: "reorder",
      title: "Ретті түзет",
      body: "",
      focus: "image",
      objectives: [{ id: "fast", text: "Код өзгергенде жинау ≤ 21 секунд болатындай қадамдарды ретте", check: (s) => s.stats.imageBuilds.some((b) => b.change === "src" && b.valid && b.seconds <= 21) }],
    },
  ],
};

export const lessonOrchestration: L = {
  id: "cloud-2-orchestration",
  labId: "cloud",
  order: 2,
  title: "Orchestration",
  summary: "Сен не керегін айтасың, контроллер оны үнемі қалпына келтіреді: desired state.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "heal",
      title: "Өзін-өзі емдеу",
      body: "",
      focus: "cluster",
      onEnter: [{ type: "mode/set", mode: "cluster" }, { type: "cluster/desired", n: 3 }],
      objectives: [{ id: "heal", text: "Pod-ты «құлат» — контроллер жаңасын жасасын", check: (s) => s.stats.podsKilled > 0 && s.stats.podsCreated > 0 }],
    },
    {
      id: "scale",
      title: "Масштабтау",
      body: "",
      focus: "cluster",
      objectives: [{ id: "five", text: "Қажетті санды 5-ке өсіріп, 5 pod жұмыс істегенін күт", check: (s) => s.cluster.desired >= 5 && s.cluster.pods.filter((p) => p.status === "running").length >= 5 }],
    },
  ],
};

export const lessonScaling: L = {
  id: "cloud-3-scaling",
  labId: "cloud",
  order: 3,
  title: "Load & Latency",
  summary: "Кезек теориясы: сервер 100% жүктелгенде кешігу шексізге ұмтылады.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "overload",
      title: "Шамадан тыс жүктеме",
      body: "",
      focus: "scale",
      onEnter: [{ type: "mode/set", mode: "scale" }, { type: "scale/set", lambda: 800, instances: 12 }],
      objectives: [{ id: "over", text: "Серверлерді азайтып, олар жүктемені көтере алмайтын күйді көр", check: (s) => s.stats.scaleChecks.some((c) => !Number.isFinite(c.latency)) }],
    },
    {
      id: "slo",
      title: "SLO-ға жет",
      body: "",
      focus: "scale",
      objectives: [{ id: "slo", text: "800 сұраныс/с кезінде кешігу ≤ 50 мс болатын ең аз сервер санын тап", check: (s) => s.stats.scaleChecks.some((c) => c.lambda === 800 && c.instances === 10 && c.latency <= 50) }],
    },
  ],
};

export const lessonAutoscale: L = {
  id: "cloud-4-autoscale",
  labId: "cloud",
  order: 4,
  title: "Autoscaling",
  summary: "Тәулік бойы жүктеме өзгереді. Автомасштабтау — SLO мен шығын арасындағы тепе-теңдік.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "fixed",
      title: "Тұрақты серверлер",
      body: "",
      focus: "autoscale",
      onEnter: [{ type: "mode/set", mode: "autoscale" }, { type: "autoscale/set", min: 8, max: 8, target: 0.6 }],
      objectives: [{ id: "fixed", text: "Тұрақты 8 сервермен тәулікті жүргіз", check: (s) => s.stats.days.some((d) => d.min === d.max && d.violations > 0) }],
    },
    {
      id: "auto",
      title: "Автомасштабтау",
      body: "",
      focus: "autoscale",
      objectives: [{ id: "auto", text: "≤ 2 SLO бұзылуы, ал шығын тұрақты 12 серверден (288 сервер·сағат) аз", check: (s) => s.stats.days.some((d) => d.min < d.max && d.violations <= 2 && d.instanceHours < 288) }],
    },
  ],
};

export const lessonCicd: L = {
  id: "cloud-5-cicd",
  labId: "cloud",
  order: 5,
  title: "CI/CD",
  summary: "Әр өзгеріс автоматты түрде тексеріліп, жиналып, шығарылады — тест құласа, ештеңе шықпайды.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "gate",
      title: "Тест — қақпа",
      body: "",
      focus: "pipeline",
      onEnter: [{ type: "mode/set", mode: "pipeline" }, { type: "pipeline/set", parallel: false, cache: false, failingTest: true }],
      objectives: [{ id: "blocked", text: "Құлаған тестпен конвейерді іске қос — deploy болмауы керек", check: (s) => s.stats.pipelines.some((p) => p.failingTest && !p.deployed) }],
    },
    {
      id: "fast",
      title: "Жылдам конвейер",
      body: "",
      focus: "pipeline",
      objectives: [{ id: "fast", text: "Тестті түзетіп, ≤ 12 минутта шығар", check: (s) => s.stats.pipelines.some((p) => p.deployed && p.minutes <= 12) }],
    },
  ],
};

export const lessonRelease: L = {
  id: "cloud-6-release",
  labId: "cloud",
  order: 6,
  title: "Release Strategies",
  summary: "Жаңа нұсқада қате бар. Оны неше пайдаланушы көреді — стратегияға байланысты.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "bigbang",
      title: "Бәріне бірден",
      body: "",
      focus: "release",
      onEnter: [{ type: "mode/set", mode: "release" }, { type: "release/strategy", strategy: "all" }],
      objectives: [{ id: "all", text: "Жаңа нұсқаны бәріне бірден шығар, сосын кері қайтар", check: (s) => s.stats.releases.some((r) => r.strategy === "all" && r.maxShare === 1 && r.rolledBack) }],
    },
    {
      id: "canary",
      title: "Canary",
      body: "",
      focus: "release",
      objectives: [{ id: "canary", text: "Canary-мен шығар және қатені ≤ 5% пайдаланушыда тоқтат", check: (s) => s.stats.releases.some((r) => r.strategy === "canary" && r.rolledBack && r.maxShare <= 0.05) }],
    },
  ],
};

export const lessonAvailability: L = {
  id: "cloud-7-availability",
  labId: "cloud",
  order: 7,
  title: "Availability",
  summary: "«Тоғыздар»: 99.9% мен 99.99%-дың арасы — жылына 8 сағат пен 52 минут.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "nines",
      title: "Репликалар",
      body: "",
      focus: "availability",
      onEnter: [{ type: "mode/set", mode: "availability" }, { type: "availability/set", replicas: 1, zones: 1 }],
      objectives: [{ id: "four", text: "Қолжетімділікті ≥ 99.99%-ға жеткіз", check: (s) => s.stats.availabilityChecks.some((c) => c.availability >= 0.9999) }],
    },
    {
      id: "zones",
      title: "Зона құлады",
      body: "",
      focus: "availability",
      objectives: [
        { id: "fail", text: "Бір зонадағы репликалармен зонаның құлауын көр", check: (s) => s.stats.zoneTests.some((z) => !z.survived) },
        { id: "survive", text: "Зона құлағанда сервис тірі қалатындай репликаларды тарат", check: (s) => s.stats.zoneTests.some((z) => z.survived) },
      ],
    },
  ],
};

export const lessonIncident: L = {
  id: "cloud-8-incident",
  labId: "cloud",
  order: 8,
  title: "Observability",
  summary: "Түнгі 3: сайт баяу. Метрикалар бойынша түпкі себепті тап.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "diagnose",
      title: "Түпкі себеп",
      body: "",
      focus: "incident",
      onEnter: [{ type: "mode/set", mode: "incident" }],
      objectives: [{ id: "root", text: "Түпкі себеп болған сервисті тап", check: (s) => s.incident.selected === ROOT_CAUSE }],
    },
  ],
};

export const cloudLessons: L[] = [lessonContainers, lessonOrchestration, lessonScaling, lessonAutoscale, lessonCicd, lessonRelease, lessonAvailability, lessonIncident, lessonPsetCloud].map((l) =>
  withDeepDives(withContent(l, cloudContent[l.id] ?? {}), cloudDeepDives[l.id] ?? {}),
);
