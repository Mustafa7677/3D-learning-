import { lessonBloat, lessonDns, lessonMtu, lessonStreams, lessonSwitch, lessonTcpStates, netMiddleContent } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { netContent } from "./content";
import { convergenceRounds } from "./core";
import { netDeepDives } from "./deep";
import type { NetLabAction, NetLabState } from "./plugin";
import { lessonPsetNet } from "./pset";

type L = LessonDefinition<NetLabState, NetLabAction>;

export const lessonPackets: L = {
  id: "net-1-packets",
  labId: "net",
  order: 1,
  title: "Packets & Layers",
  summary: "Үлкен хабар кішкене пакеттерге бөлінеді, әр қабат өз тақырыбын қосады.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "split",
      title: "Пакеттерге бөлу",
      body: "",
      focus: "packets",
      onEnter: [{ type: "mode/set", mode: "packets" }],
      objectives: [{ id: "mb", text: "1 МБ файлды 1500 байттық MTU-мен пакеттерге бөл", check: (s) => s.stats.packetRuns.some((r) => r.size >= 1_000_000 && r.mtu === 1500) }],
    },
    {
      id: "overhead",
      title: "Тақырыптардың бағасы",
      body: "",
      focus: "packets",
      objectives: [
        { id: "small", text: "Тиімділігі 70%-дан төмен кішкене хабарды жібер", check: (s) => s.stats.packetRuns.some((r) => r.efficiency < 0.7) },
        { id: "mtu", text: "Бір хабарды кемінде екі түрлі MTU-мен салыстыр", check: (s) => s.stats.packetRuns.some((r) => s.stats.packetRuns.some((q) => q.size === r.size && q.mtu !== r.mtu)) },
      ],
    },
  ],
};

export const lessonIp: L = {
  id: "net-2-ip",
  labId: "net",
  order: 2,
  title: "IP Addresses & Subnets",
  summary: "32 бит, маска және CIDR: адрестің қай бөлігі: желі, қайсысы: құрылғы.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "cidr",
      title: "CIDR",
      body: "",
      focus: "ip",
      onEnter: [{ type: "mode/set", mode: "ip" }],
      objectives: [{ id: "26", text: "192.168.10.77/26 желісінің адресін тап", check: (s) => s.stats.ipQueries.some((q) => q.addr === "192.168.10.77" && q.prefix === 26) }],
    },
    {
      id: "same",
      title: "Бір желіде ме?",
      body: "",
      focus: "ip",
      objectives: [
        {
          id: "split",
          text: "Екі адрес бір префиксте бір желіде, ал ұзынырақ префиксте әр түрлі желіде болатынын көрсет",
          check: (s) => s.stats.ipQueries.some((a) => a.same && s.stats.ipQueries.some((b) => b.addr === a.addr && b.other === a.other && b.prefix > a.prefix && !b.same)),
        },
      ],
    },
  ],
};

export const lessonRouting: L = {
  id: "net-3-routing",
  labId: "net",
  order: 3,
  title: "Routing",
  summary: "Маршрутизаторлар пакетті ең арзан жолмен жібереді: және сызық үзілсе, айналып өтеді.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "send",
      title: "Ең арзан жол",
      body: "",
      focus: "routing",
      onEnter: [{ type: "mode/set", mode: "routing" }, { type: "route/algo", algo: "ls" }, { type: "route/set", from: "A", to: "F" }],
      objectives: [{ id: "af", text: "A-дан F-ке пакет жібер", check: (s) => s.stats.routeRuns.some((r) => r.from === "A" && r.to === "F" && r.failed.length === 0) }],
    },
    {
      id: "fail",
      title: "Сызық үзілді",
      body: "",
      focus: "routing",
      objectives: [{ id: "reroute", text: "Жолдағы бір сызықты үз де, қайта жібер: пакет айналып өтсін", check: (s) => s.stats.routeRuns.some((r) => r.from === "A" && r.to === "F" && r.failed.includes("BD") && r.cost > 0) }],
    },
    {
      id: "partition",
      title: "Желі бөлінді",
      body: "",
      focus: "routing",
      objectives: [{ id: "cut", text: "F-ке ешбір жол қалмайтындай сызықтарды үз", check: (s) => s.stats.routeRuns.some((r) => r.to === "F" && r.cost < 0) }],
    },
  ],
};

export const lessonDv: L = {
  id: "net-4-dv",
  labId: "net",
  order: 4,
  title: "Distance Vector",
  summary: "Ешкім бүкіл картаны білмейді: көршілер бір-біріне айтып, кестелер біртіндеп дұрысталады.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "converge",
      title: "Раунд сайын",
      body: "",
      focus: "routing",
      onEnter: [{ type: "mode/set", mode: "routing" }, { type: "route/algo", algo: "dv" }],
      objectives: [{ id: "conv", text: "Кестелер тұрақтанғанша раундтарды жүргіз", check: (s) => s.stats.dvViews.some((v) => v.failed.length === 0 && v.rounds >= convergenceRounds("F")) }],
    },
    {
      id: "failure",
      title: "Үзілістен кейін",
      body: "",
      focus: "routing",
      objectives: [{ id: "again", text: "BD сызығын үзіп, кестелер қайта тұрақтанғанша жүргіз", check: (s) => s.stats.dvViews.some((v) => v.failed.includes("BD") && v.rounds >= convergenceRounds("F", v.failed)) }],
    },
  ],
};

export const lessonReliable: L = {
  id: "net-5-reliable",
  labId: "net",
  order: 5,
  title: "Reliable Delivery",
  summary: "Желі пакеттерді жоғалтады. TCP оларды ACK, таймер және қайта жіберу арқылы жеткізеді.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "stopwait",
      title: "Stop-and-wait",
      body: "",
      focus: "transport",
      onEnter: [{ type: "mode/set", mode: "transport" }, { type: "tx/set", protocol: "stopwait", loss: 0 }],
      objectives: [{ id: "run", text: "Stop-and-wait-пен 50 пакет жібер", check: (s) => s.stats.transfers.some((t) => t.protocol === "stopwait") }],
    },
    {
      id: "loss",
      title: "Жоғалған пакеттер",
      body: "",
      focus: "transport",
      objectives: [{ id: "retx", text: "Кемінде 10% жоғалтумен жібер: қайта жіберулерді бақыла", check: (s) => s.stats.transfers.some((t) => t.loss >= 0.1 && t.retransmits > 0) }],
    },
  ],
};

export const lessonWindow: L = {
  id: "net-6-window",
  labId: "net",
  order: 6,
  title: "Sliding Window",
  summary: "Арнаны толтыру: bandwidth-delay product және терезе өлшемі.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "window",
      title: "Терезе",
      body: "",
      focus: "transport",
      onEnter: [{ type: "mode/set", mode: "transport" }, { type: "tx/set", protocol: "window", window: 4, loss: 0 }],
      objectives: [{ id: "80", text: "Жоғалтусыз арнаны ≥ 80% пайдалан", check: (s) => s.stats.transfers.some((t) => t.protocol === "window" && t.loss === 0 && t.utilization >= 0.8) }],
    },
    {
      id: "bdp",
      title: "Ең кіші жеткілікті терезе",
      body: "",
      focus: "transport",
      objectives: [{ id: "min", text: "≥ 80%-ға жететін ең кіші терезені тап (RTT = 10)", check: (s) => s.stats.transfers.some((t) => t.protocol === "window" && t.loss === 0 && t.utilization >= 0.8 && t.window === 10) }],
    },
  ],
};

export const lessonCongestion: L = {
  id: "net-7-congestion",
  labId: "net",
  order: 7,
  title: "Congestion Control",
  summary: "Интернет құламауы үшін: slow start, AIMD «ара тісі», Tahoe мен Reno.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "reno",
      title: "Slow start және AIMD",
      body: "",
      focus: "congestion",
      onEnter: [{ type: "mode/set", mode: "congestion" }, { type: "cc/set", variant: "reno", capacity: 20 }],
      objectives: [{ id: "run", text: "Reno-ны іске қосып, ара тісін көр", check: (s) => s.stats.congestionRuns.some((r) => r.variant === "reno" && r.losses > 1) }],
    },
    {
      id: "tahoe",
      title: "Tahoe мен Reno",
      body: "",
      focus: "congestion",
      objectives: [{ id: "tahoe", text: "Сол сыйымдылықта Tahoe-ны іске қосып салыстыр", check: (s) => s.stats.congestionRuns.some((r) => r.variant === "tahoe") }],
    },
  ],
};

export const lessonNat: L = {
  id: "net-8-nat",
  labId: "net",
  order: 8,
  title: "NAT",
  summary: "Бір ашық IP артында жүздеген құрылғы: адрес аудару кестесі.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "out",
      title: "Сыртқа шығу",
      body: "",
      focus: "nat",
      onEnter: [{ type: "mode/set", mode: "nat" }, { type: "nat/reset" }],
      objectives: [{ id: "two", text: "Екі түрлі ішкі құрылғыдан сыртқа сұраныс жібер", check: (s) => new Set(s.nat.table.map((e) => e.inside)).size >= 2 }],
    },
    {
      id: "in",
      title: "Ішке кіру",
      body: "",
      focus: "nat",
      objectives: [
        { id: "reply", text: "Жауапты дұрыс құрылғыға жеткіз", check: (s) => s.stats.natDelivered > 0 },
        { id: "drop", text: "Шақырылмаған пакеттің тасталғанын көр", check: (s) => s.stats.natDropped > 0 },
      ],
    },
  ],
};

export const netLessons: L[] = [
  lessonPackets,
  lessonIp,
  lessonRouting,
  lessonDv,
  lessonReliable,
  lessonWindow,
  lessonCongestion,
  lessonNat,
  lessonPsetNet,
  // Middle level
  lessonDns,
  lessonTcpStates,
  lessonSwitch,
  lessonStreams,
  lessonMtu,
  lessonBloat,
].map((l) => withDeepDives(withContent(l, netContent[l.id] ?? netMiddleContent[l.id] ?? {}), netDeepDives[l.id] ?? {}));
