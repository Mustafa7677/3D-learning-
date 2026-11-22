/**
 * Linear Algebra, the first subject of the first year: eight lessons, each a
 * 3D experiment. Objectives read the simulation state, never the learner's
 * words.
 */
import { withContent, type LessonDefinition } from "@inside-tech/lesson-engine";
import { add, combo, det, det2, eigenFactor, dirOf, isEchelon, len, near, nearV, parallel, projLen, sameM, dot, solutionOf, type V2 } from "./linalg";
import { EIGEN_PRESETS, PRESETS, type MathLabAction, type MathLabState } from "./plugin";
import { mathContent } from "./content";
import { mathMedia } from "./media";
import { mathFilms } from "./films";
import type { StepContent } from "@inside-tech/lesson-engine";

type L = LessonDefinition<MathLabState, MathLabAction>;
type S = MathLabState;

export const BASIS_TARGET: V2 = [3, 1];

const snaps = (s: S) => s.stats.vectorSnaps;
const mats = (s: S) => s.stats.matrices;

const vectors: L = {
  id: "la-1-vectors",
  labId: "math",
  order: 1,
  title: "Векторлар және олармен амалдар",
  summary: "Вектор: кеңістіктегі көрсеткі де, сандар тізімі де. Қосу көрсеткілерді тізбектеп жүру, санға көбейту оны созу.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "add",
      title: "Көрсеткілерді тізбектеу",
      body: "",
      focus: "vectors",
      onEnter: [{ type: "mode/set", mode: "vectors" }, { type: "vec/set", which: "u", value: [3, 1, 0] }, { type: "vec/set", which: "v", value: [1, 2, 0] }, { type: "vec/k", k: 1 }],
      objectives: [
        { id: "sum", text: "u = (3, 1, 0) тұр. v-ны таңда: u + v = (4, 3, 2)", check: (s) => snaps(s).some((x) => nearV(x.u, [3, 1, 0]) && nearV(add(x.u, x.v), [4, 3, 2])) },
        { id: "ab", text: "A(1, 1, 0) нүктесінен B(4, 5, 0) нүктесіне апаратын AB векторын v етіп қой: оның ұзындығы 5", check: (s) => snaps(s).some((x) => nearV(x.v, [3, 4, 0])) },
      ],
    },
    {
      id: "scale",
      title: "Санға көбейту",
      body: "",
      focus: "vectors",
      objectives: [
        { id: "neg", text: "k·u екі есе ұзын әрі кері бағытта болсын", check: (s) => snaps(s).some((x) => near(x.k, -2)) },
        { id: "half", text: "k·u жартысына дейін қысқарсын, бағыты сол", check: (s) => snaps(s).some((x) => near(x.k, 0.5)) },
      ],
    },
  ],
};

const dotLesson: L = {
  id: "la-2-dot",
  labId: "math",
  order: 2,
  title: "Скаляр көбейтінді және ортогональдық",
  summary: "Екі вектордан бір сан: бір бағытта болса оң, перпендикуляр болса нөл, қарама-қарсы болса теріс. Бұрыш пен проекцияның құралы.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "ortho",
      title: "Тік бұрыш",
      body: "",
      focus: "dot",
      onEnter: [{ type: "mode/set", mode: "dot" }, { type: "vec/set", which: "u", value: [2, 1, 0] }, { type: "vec/set", which: "v", value: [1, 3, 0] }],
      objectives: [
        { id: "zero", text: "v-ны u-ға перпендикуляр етіп қой: u·v = 0 (v нөл емес)", check: (s) => snaps(s).some((x) => len(x.v) > 0.01 && near(dot(x.u, x.v), 0)) },
        { id: "neg", text: "Енді доғал бұрыш жаса: u·v теріс", check: (s) => snaps(s).some((x) => dot(x.u, x.v) < -0.01) },
      ],
    },
    {
      id: "proj",
      title: "Проекция",
      body: "",
      focus: "dot",
      onEnter: [{ type: "vec/set", which: "u", value: [4, 0, 0] }, { type: "vec/set", which: "v", value: [1, 1, 0] }],
      objectives: [
        { id: "p3", text: "v-ның u бағытындағы проекциясы 3 болсын, бірақ v u бойында жатпасын", check: (s) => nearV(s.u, [4, 0, 0]) && near(projLen(s.u, s.v), 3) && !parallel(s.u, s.v) },
        { id: "len5", text: "Сол проекциямен v-ның ұзындығы 5 болсын", check: (s) => nearV(s.u, [4, 0, 0]) && near(projLen(s.u, s.v), 3) && near(len(s.v), 5) },
      ],
    },
  ],
};

const gauss: L = {
  id: "la-3-gauss",
  labId: "math",
  order: 3,
  title: "Сызықтық теңдеулер жүйесі және Гаусс әдісі",
  summary: "Үш теңдеу: кеңістіктегі үш жазықтық, ал шешімі олардың қиылысу нүктесі. Белгісіздерді біртіндеп жойып, баспалдаққа келтіру.",
  estimatedMinutes: 30,
  steps: [
    {
      id: "forward",
      title: "Төмен қарай жою",
      body: "",
      focus: "gauss",
      onEnter: [{ type: "mode/set", mode: "gauss" }, { type: "gauss/reset" }],
      objectives: [
        { id: "col1", text: "Бірінші бағанда R1-ден төменгі екі санды нөлге айналдыр", check: (s) => near(s.sys[1][0], 0) && near(s.sys[2][0], 0) && !near(s.sys[0][0], 0) },
        { id: "stair", text: "Баспалдақ: R3-тегі y коэффициенті де нөл", check: (s) => isEchelon(s.sys) },
      ],
    },
    {
      id: "back",
      title: "Жоғары қарай: шешім",
      body: "",
      focus: "gauss",
      objectives: [{ id: "solved", text: "Сол жақ блокты бірлік матрицаға келтір: оң жақ баған шешімді береді", check: (s) => nearV(solutionOf(s.sys) ?? [9, 9, 9], [1, 2, 3]) }],
    },
  ],
};

const matrices: L = {
  id: "la-4-matrices",
  labId: "math",
  order: 4,
  title: "Матрицалар және матрицалық амалдар",
  summary: "Матрица сандар кестесі емес, машина: ол бүкіл кеңістікті бұрады, созады, қисайтады. Бағандары базис векторларының қайда баратынын айтады.",
  estimatedMinutes: 30,
  steps: [
    {
      id: "columns",
      title: "Бағандар: базис қайда барады",
      body: "",
      focus: "matrix",
      onEnter: [{ type: "mode/set", mode: "matrix" }, { type: "matrix/preset", name: "identity" }],
      objectives: [
        { id: "rot", text: "Ұяшықтарды өзгертіп, z осінен 90° бұратын матрицаны құр: e1 → (0, 1, 0), e2 → (−1, 0, 0)", check: (s) => mats(s).some((x) => x.via === "edit" && sameM(x.m, PRESETS.rot90!)) },
        { id: "shear", text: "Ығысу: e1 орнында, e2 → (1, 1, 0), e3 орнында", check: (s) => mats(s).some((x) => x.via === "edit" && sameM(x.m, PRESETS.shear!)) },
      ],
    },
    {
      id: "compose",
      title: "Көбейту: машиналарды тізбектеу",
      body: "",
      focus: "matrix",
      onEnter: [{ type: "matrix/preset", name: "rot90" }],
      objectives: [
        { id: "twice", text: "Тағы 90° бұрып көбейт: 180° бұрылыс шықты", check: (s) => mats(s).some((x) => x.via === "compose" && sameM(x.m, [[-1, 0, 0], [0, -1, 0], [0, 0, 1]])) },
        { id: "four", text: "Барлығы төрт рет бұр: кеңістік бастапқы қалпына оралды (I)", check: (s) => mats(s).filter((x) => x.via === "compose").length >= 3 && sameM(s.A, PRESETS.identity!) },
      ],
    },
  ],
};

const inv = (s: S) => s.stats.inverseTries;

const inverseLesson: L = {
  id: "la-5-inverse",
  labId: "math",
  order: 5,
  title: "Кері матрица және LU жіктелуі",
  summary: "A⁻¹ матрицасы A жасаған түрлендіруді болдырмайды. Ол тек A ақпаратты жоғалтпаса бар: кеңістікті жазықтыққа жаншыған матрицаның керісі жоқ.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "undo",
      title: "Болдырмау",
      body: "",
      focus: "inverse",
      onEnter: [{ type: "mode/set", mode: "inverse" }, { type: "matrix/preset", name: "shear" }],
      objectives: [
        { id: "shear", text: "Ығысуға A⁻¹-ді қолдан: текше орнына оралды", check: (s) => inv(s).some((x) => x.ok && sameM(x.m, PRESETS.shear!)) },
        { id: "stretch", text: "Созуды таңдап, оны да кері қайтар", check: (s) => inv(s).some((x) => x.ok && sameM(x.m, PRESETS.stretch!)) },
      ],
    },
    {
      id: "singular",
      title: "Қайтару мүмкін емес",
      body: "",
      focus: "inverse",
      onEnter: [{ type: "matrix/preset", name: "flatten" }],
      objectives: [{ id: "none", text: "Жаншитын матрицаға A⁻¹ қолданып көр: ол жоқ", check: (s) => inv(s).some((x) => !x.ok) }],
    },
  ],
};

const determinant: L = {
  id: "la-6-determinant",
  labId: "math",
  order: 6,
  title: "Анықтауыш",
  summary: "Анықтауыш: матрица көлемді неше есе өзгертетінін айтатын бір сан. Нөл болса, кеңістік жаншылады; теріс болса, айнадай аударылады.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "volume",
      title: "Көлемнің еселігі",
      body: "",
      focus: "det",
      onEnter: [{ type: "mode/set", mode: "det" }, { type: "matrix/preset", name: "identity" }],
      objectives: [
        { id: "six", text: "Бірлік текшені көлемі 6 болатын қорапқа айналдыр: det A = 6", check: (s) => mats(s).some((x) => near(det(x.m), 6)) },
        { id: "shear", text: "Ығысу: пішіні өзгереді, ал көлемі сол (det = 1, бірақ A ≠ I)", check: (s) => mats(s).some((x) => near(det(x.m), 1) && !sameM(x.m, PRESETS.identity!)) },
      ],
    },
    {
      id: "flat",
      title: "Жаншу және аудару",
      body: "",
      focus: "det",
      objectives: [
        { id: "zero", text: "Текшені жазыққа жанш: det A = 0", check: (s) => mats(s).some((x) => near(det(x.m), 0)) },
        { id: "neg", text: "Кеңістікті айнадай аудар: det A теріс", check: (s) => mats(s).some((x) => det(x.m) < -0.01) },
      ],
    },
  ],
};

const bs = (s: S) => s.stats.basisSnaps;
const reaches = (x: { b1: V2; b2: V2; a: number; b: number }) => nearV(combo(x.a, x.b1, x.b, x.b2), BASIS_TARGET);

const basis: L = {
  id: "la-7-basis",
  labId: "math",
  order: 7,
  title: "Векторлық кеңістік, базис және сызықтық бейнелеу",
  summary: "Базис: бүкіл кеңістікті құрастыруға жететін ең аз кірпіштер. Бір нүктенің координаталары базиске байланысты, ал тәуелді векторлар кеңістікті толтыра алмайды.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "coords",
      title: "Жаңа тор, жаңа координаталар",
      body: "",
      focus: "basis",
      onEnter: [{ type: "mode/set", mode: "basis" }, { type: "basis/set", b1: [1, 1], b2: [1, -1], a: 0, b: 0 }],
      objectives: [
        { id: "skew", text: "b1 = (1, 1), b2 = (1, −1) базисінде t = (3, 1) нүктесіне жет: a·b1 + b·b2 = t", check: (s) => bs(s).some((x) => nearV(x.b1, [1, 1]) && nearV(x.b2, [1, -1]) && reaches(x)) },
        { id: "std", text: "Стандарт базисте (1, 0) және (0, 1) сол нүктенің координаталарын тап", check: (s) => bs(s).some((x) => nearV(x.b1, [1, 0]) && nearV(x.b2, [0, 1]) && reaches(x)) },
      ],
    },
    {
      id: "span",
      title: "Тәуелді векторлар",
      body: "",
      focus: "basis",
      objectives: [
        { id: "dep", text: "b2-ні b1-ге параллель етіп қой: тор бір түзуге жиналады", check: (s) => bs(s).some((x) => near(det2(x.b1, x.b2), 0) && Math.hypot(...x.b1) > 0 && Math.hypot(...x.b2) > 0) },
        {
          id: "back",
          text: "Тәуелсіз базиске қайтып, t-ға қайта жет",
          check: (s) => {
            const i = bs(s).findIndex((x) => near(det2(x.b1, x.b2), 0) && Math.hypot(...x.b1) > 0);
            return i >= 0 && bs(s).slice(i + 1).some((x) => !near(det2(x.b1, x.b2), 0) && reaches(x));
          },
        },
      ],
    },
  ],
};

const ep = (s: S) => s.stats.eigenProbes;
const isEigen = (name: keyof typeof EIGEN_PRESETS, deg: number) => eigenFactor(EIGEN_PRESETS[name], dirOf(deg)) !== null;

const eigen: L = {
  id: "la-8-eigen",
  labId: "math",
  order: 8,
  title: "Меншікті мәндер мен меншікті векторлар",
  summary: "Матрица көп векторды бұрады, бірақ кейбір ерекше бағыттарды тек созады. Сол бағыттарды өз көзіңмен табу: Av = λv.",
  estimatedMinutes: 30,
  steps: [
    {
      id: "find",
      title: "Бұрылмайтын бағыттар",
      body: "",
      focus: "eigen",
      onEnter: [{ type: "mode/set", mode: "eigen" }, { type: "eigen/preset", name: "symmetric" }],
      objectives: [
        { id: "l3", text: "A = [[2, 1], [1, 2]]: 3 есе созылатын бағытты тап", check: (s) => ep(s).some((x) => x.preset === "symmetric" && isEigen("symmetric", x.deg) && near(eigenFactor(EIGEN_PRESETS.symmetric, dirOf(x.deg))!, 3)) },
        { id: "l1", text: "Ұзындығы мүлде өзгермейтін екінші бағытты тап (λ = 1)", check: (s) => ep(s).some((x) => x.preset === "symmetric" && isEigen("symmetric", x.deg) && near(eigenFactor(EIGEN_PRESETS.symmetric, dirOf(x.deg))!, 1)) },
      ],
    },
    {
      id: "others",
      title: "Ығысу мен бұрылыс",
      body: "",
      focus: "eigen",
      onEnter: [{ type: "eigen/preset", name: "shear2" }],
      objectives: [
        { id: "shear", text: "Ығысудың жалғыз меншікті бағытын тап", check: (s) => ep(s).some((x) => x.preset === "shear2" && isEigen("shear2", x.deg)) },
        { id: "rot", text: "90° бұрылыста кемінде 4 бағытты байқап көр: бірде-бірі өз түзуінде қалмайды", check: (s) => new Set(ep(s).filter((x) => x.preset === "rotation2").map((x) => x.deg)).size >= 4 },
      ],
    },
  ],
};

export const mathLessons: L[] = [vectors, dotLesson, gauss, matrices, inverseLesson, determinant, basis, eigen].map((l) => withContent(l, merged(l.id, l.steps.at(-1)!.id)));

/**
 * Prose, questions and the math-specific forms (comic, board, error hunt) of one lesson. The
 * solution film plays at the end, on the last step: practice first, then the cinema.
 */
function merged(id: string, last: string): Record<string, StepContent> {
  const out: Record<string, StepContent> = {};
  for (const [step, c] of Object.entries(mathContent[id] ?? {})) out[step] = { ...c };
  for (const [step, m] of Object.entries(mathMedia[id] ?? {})) out[step] = { ...(out[step] ?? {}), ...m };
  for (const film of Object.values(mathFilms[id] ?? {})) out[last] = { ...(out[last] ?? {}), film };
  return out;
}
