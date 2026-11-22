import { iotMiddleContent, lessonBuses, lessonFusion, lessonPwm, lessonRtos } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { iotContent } from "./content";
import { minBitsFor } from "./core";
import { iotDeepDives } from "./deep";
import type { IotLabAction, IotLabState } from "./plugin";
import { lessonPsetIot } from "./pset";

type L = LessonDefinition<IotLabState, IotLabAction>;

const HOME_TEMPS = ["home/bedroom/temp", "home/kitchen/temp"];
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

export const lessonAdc: L = {
  id: "iot-1-adc",
  labId: "iot",
  order: 1,
  title: "Sensors & ADC",
  summary: "Сенсор кернеу береді, микроконтроллер сан көреді. Арадағы АЦП-ның разряды дәлдікті анықтайды.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "read",
      title: "Кернеуден санға",
      body: "",
      focus: "adc",
      onEnter: [{ type: "mode/set", mode: "adc" }, { type: "adc/set", bits: 8, tempC: 23.47 }],
      objectives: [{ id: "read8", text: "8-разрядты АЦП-мен температураны оқы: қате қанша?", check: (s) => s.stats.adcReads.some((r) => r.bits === 8) }],
    },
    {
      id: "bits",
      title: "Разрядты таңда",
      body: "",
      focus: "adc",
      objectives: [{ id: "min", text: "0.1 °C ажыратымдылық беретін ең аз разрядпен оқы", check: (s) => s.stats.adcReads.some((r) => r.bits === minBitsFor(0.1)) }],
    },
  ],
};

export const lessonSampling: L = {
  id: "iot-2-sampling",
  labId: "iot",
  order: 2,
  title: "Sampling & Aliasing",
  summary: "Сигналды сирек өлшесең, ол басқа жиілікке «бүркенеді». Найквист шегі.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "alias",
      title: "Алиасинг",
      body: "",
      focus: "sampling",
      onEnter: [{ type: "mode/set", mode: "sampling" }, { type: "sampling/set", f: 50, fs: 400, record: false }],
      objectives: [{ id: "alias", text: "50 Гц сигналды тым сирек өлшеп, жалған жиілікті көр", check: (s) => s.stats.samplings.some((x) => x.f === 50 && x.alias !== 50) }],
    },
    {
      id: "nyquist",
      title: "Найквист",
      body: "",
      focus: "sampling",
      objectives: [{ id: "ok", text: "50 Гц-ті дұрыс көретін, бірақ 150 Гц-тен аспайтын жиілікпен өлше", check: (s) => s.stats.samplings.some((x) => x.f === 50 && x.fs > 100 && x.fs <= 150 && x.alias === 50) }],
    },
  ],
};

export const lessonFilter: L = {
  id: "iot-3-filter",
  labId: "iot",
  order: 3,
  title: "Noise & Filtering",
  summary: "Шуды сүзу: әрдайым кешігу бағасымен. Экспоненциалды орташа және оның α параметрі.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "raw",
      title: "Шулы сенсор",
      body: "",
      focus: "filter",
      onEnter: [{ type: "mode/set", mode: "filter" }, { type: "filter/set", alpha: 1 }],
      objectives: [{ id: "raw", text: "Сүзгісіз (α = 1) сигналды жүргіз", check: (s) => s.stats.filterRuns.some((r) => r.alpha === 1) }],
    },
    {
      id: "tune",
      title: "α-ны баптау",
      body: "",
      focus: "filter",
      objectives: [{ id: "tune", text: "Шу ≤ 0.4 °C және кешігу ≤ 12 қадам", check: (s) => s.stats.filterRuns.some((r) => r.noise <= 0.4 && r.lag <= 12) }],
    },
  ],
};

export const lessonThermo: L = {
  id: "iot-4-thermostat",
  labId: "iot",
  order: 4,
  title: "On/Off Control",
  summary: "Термостат: қосу/өшіру реттегіші және гистерезистің не үшін керек екені.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "chatter",
      title: "Діріл",
      body: "",
      focus: "thermo",
      onEnter: [{ type: "mode/set", mode: "thermo" }, { type: "thermo/set", hysteresis: 0 }],
      objectives: [{ id: "chatter", text: "Гистерезиссіз жүргіз: реле неше рет қосылды?", check: (s) => s.stats.thermoRuns.some((r) => r.hysteresis === 0) }],
    },
    {
      id: "hysteresis",
      title: "Гистерезис",
      body: "",
      focus: "thermo",
      objectives: [{ id: "ok", text: "≤ 100 қосылу және температура 21 °C-тан ≤ 1 °C ауытқиды", check: (s) => s.stats.thermoRuns.some((r) => r.switches <= 100 && r.maxDev <= 1) }],
    },
  ],
};

export const lessonPid: L = {
  id: "iot-5-pid",
  labId: "iot",
  order: 5,
  title: "PID Control",
  summary: "Лифтті дәл 1 метрге көтер: пропорционал, интеграл және дифференциал құрамдар.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "p",
      title: "Тек P",
      body: "",
      focus: "pid",
      onEnter: [{ type: "mode/set", mode: "pid" }, { type: "pid/set", kp: 5, ki: 0, kd: 0, plant: "lift" }],
      objectives: [{ id: "sserr", text: "Тек P-мен жүргізіп, тұрақты қатені көр", check: (s) => s.stats.pidRuns.some((r) => r.ki === 0 && r.plant === "lift" && r.ssError > 0.05) }],
    },
    {
      id: "tune",
      title: "PID баптау",
      body: "",
      focus: "pid",
      objectives: [
        {
          id: "tuned",
          text: "Асып кету ≤ 10%, орнығу ≤ 3 с, тұрақты қате ≤ 0.02 м",
          check: (s) => s.stats.pidRuns.some((r) => r.plant === "lift" && r.overshoot <= 0.1 && r.settle <= 3 && r.ssError <= 0.02),
        },
      ],
    },
  ],
};

export const lessonArm: L = {
  id: "iot-6-arm",
  labId: "iot",
  order: 6,
  title: "Robot Arm Kinematics",
  summary: "Тура кинематика: бұрыштардан нүктеге. Кері кинематика: нүктеден бұрыштарға: және оның екі шешімі.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "fk",
      title: "Тура кинематика",
      body: "",
      focus: "arm",
      onEnter: [{ type: "mode/set", mode: "arm" }, { type: "arm/target", target: 0 }, { type: "arm/set", t1: 0, t2: 0 }],
      objectives: [{ id: "fk", text: "Буындарды бұрап, қолды нысанаға (2.5; 1.5) 0.1-ден жақын жеткіз", check: (s) => s.stats.armReaches.some((r) => r.target === 0 && r.by === "fk") }],
    },
    {
      id: "ik",
      title: "Кері кинематика",
      body: "",
      focus: "arm",
      onEnter: [{ type: "arm/target", target: 1 }],
      objectives: [
        { id: "both", text: "(−1; 2.5) нүктесіне екі түрлі шешіммен (шынтақ жоғары/төмен) жет", check: (s) => ["up", "down"].every((e) => s.stats.armReaches.some((r) => r.target === 1 && r.by === "ik" && r.elbow === e)) },
        { id: "far", text: "(4; 2) нүктесіне жетуге тырысып көр", check: (s) => s.stats.unreachable.includes(2) },
      ],
    },
  ],
};

export const lessonKalman: L = {
  id: "iot-7-kalman",
  labId: "iot",
  order: 7,
  title: "Sensor Fusion",
  summary: "Одометрия дрейфтейді, GPS шулы. Калман сүзгісі екеуінен де дәлірек баға береді.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "extremes",
      title: "Кімге сенеміз?",
      body: "",
      focus: "kalman",
      onEnter: [{ type: "mode/set", mode: "kalman" }, { type: "kalman/set", q: 0.05, r: 9, gpsNoise: 3 }],
      objectives: [
        { id: "odo", text: "Тек одометрияға сен (r ≥ 100)", check: (s) => s.stats.kalmanRuns.some((k) => k.r >= 100) },
        { id: "gps", text: "Тек GPS-ке сен (q ≥ 10)", check: (s) => s.stats.kalmanRuns.some((k) => k.q >= 10) },
      ],
    },
    {
      id: "fuse",
      title: "Біріктіру",
      body: "",
      focus: "kalman",
      objectives: [{ id: "fuse", text: "Біріккен бағаның қатесі (RMSE) ≤ 1.0 м: екі сенсордан да 2 есе дәл", check: (s) => s.stats.kalmanRuns.some((k) => k.gpsNoise === 3 && k.fused <= 1) }],
    },
  ],
};

export const lessonMqtt: L = {
  id: "iot-8-mqtt",
  labId: "iot",
  order: 8,
  title: "MQTT & Power",
  summary: "Құрылғылар хабарды тақырыптарға жариялайды. Әр хабар: батареядан алынған заряд.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "topics",
      title: "Тақырыптар мен сүзгілер",
      body: "",
      focus: "mqtt",
      onEnter: [{ type: "mode/set", mode: "mqtt" }],
      objectives: [{ id: "temps", text: "Үйдегі барлық температура сенсорына, тек соларға жазыл", check: (s) => s.stats.subscriptions.some((x) => sameSet(x.matches, HOME_TEMPS) && x.filter.includes("+")) }],
    },
    {
      id: "power",
      title: "Батарея бюджеті",
      body: "",
      focus: "power",
      onEnter: [{ type: "mode/set", mode: "power" }],
      objectives: [{ id: "year", text: "Wi-Fi-мен ≥ 1 жыл істейтін ең жиі есеп беру аралығын тап", check: (s) => s.stats.powerChecks.some((p) => p.radio === "wifi" && p.minutes === 15 && p.days >= 365) }],
    },
  ],
};

export const iotLessons: L[] = [
  lessonAdc,
  lessonSampling,
  lessonFilter,
  lessonThermo,
  lessonPid,
  lessonArm,
  lessonKalman,
  lessonMqtt,
  lessonPsetIot,
  // Middle level
  lessonPwm,
  lessonBuses,
  lessonRtos,
  lessonFusion,
].map((l) => withDeepDives(withContent(l, iotContent[l.id] ?? iotMiddleContent[l.id] ?? {}), iotDeepDives[l.id] ?? {}));
