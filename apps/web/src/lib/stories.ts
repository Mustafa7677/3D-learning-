/**
 * Тірі заттар: illustrated stories where the machines themselves talk. A laptop wakes up, a
 * packet travels, a server gets tired, a virus plays tricks. Every panel has a drawn place, the
 * gadget characters act next to Нұрай, Мустафа and Ұстаз, and each story ends on a lesson.
 */
import type { Comic } from "@inside-tech/lesson-engine";

export interface Story {
  id: string;
  labId: string;
  lessonId: string;
  comic: Comic;
}

export const STORIES: Story[] = [
  {
    id: "laptop-day",
    labId: "arch",
    lessonId: "arch-1-binary",
    comic: {
      title: "Ноуттың бір күні",
      genre: "Тірі заттар",
      tagline: "Мустафа батырманы басты. Ноутбуктың ішінде бір секундта не болды?",
      panels: [
        { scene: "07:30 · МУСТАФАНЫҢ БӨЛМЕСІ", bg: "room", who: "laptop", mood: "confused", say: "Ммм… Кім мені оятты? Ток келді! Алдымен өзімді тексерейін: жады бар ма, диск бар ма?", sfx: "ДЗЫҢ!" },
        { bg: "room", who: "mustafa", mood: "smile", say: "Тезірек, ноутым! Үй тапсырмасын жіберуім керек.", with: ["laptop"] },
        { scene: "ІШКІ ӘЛЕМ · АНА ПЛАТА", bg: "circuit", who: "cpu", mood: "explain", say: "Мен процессормын. Секундына миллиардтаған рет бір нәрсе істеймін: командаға ал, түсін, орында.", board: "алу → түсіну → орындау\n(fetch → decode → execute)" },
        { bg: "circuit", who: "laptop", mood: "think", say: "Бірақ командалар қайда сақталған? Дискіден әр жолы алу өте баяу ғой." },
        { bg: "circuit", who: "cpu", mood: "smile", say: "Сондықтан жиі керек нәрсені жедел жадқа, ал ең жиісін өзімнің кэшіме қоямын. Жақын тұрған тез табылады.", board: "кэш ≈ 1 нс · жедел жад ≈ 100 нс · SSD ≈ 100 000 нс" },
        { scene: "07:31", bg: "room", who: "laptop", mood: "wow", say: "Дайынмын! Бәрі 0 мен 1 арқылы жүрді: ток бар, ток жоқ. Бар болғаны осы!", with: ["mustafa"] },
        { bg: "room", who: "ustaz", mood: "smile", say: "Әр компьютер осылай: екі күй, миллиардтаған ажыратқыш және жылдамдықтың баспалдағы. Сабақта ішіне кіреміз." },
      ],
    },
  },
  {
    id: "packet-trip",
    labId: "net",
    lessonId: "net-1-packets",
    comic: {
      title: "Пакеттің ұзақ сапары",
      genre: "Тірі заттар",
      tagline: "Ол Нұрайдың суретінің бір кішкентай бөлігі. Оның міндеті: Алматыға жету.",
      panels: [
        { scene: "ТАРАЗ · НҰРАЙДЫҢ ТЕЛЕФОНЫ", bg: "room", who: "phone", mood: "explain", say: "Сурет 3 мегабайт. Оны екі мыңнан астам пакетке бөлемін. Әрқайсысына мекенжай мен нөмір жазамын.", with: ["packet"] },
        { bg: "city", who: "packet", mood: "wow", say: "Мен №1047 пакетпін! Ішімде суреттің бір бұрышы бар. Алға!", sfx: "ВЖУХ!" },
        { scene: "ҚАЛА ҮСТІ · МАРШРУТИЗАТОР", bg: "city", who: "packet", mood: "confused", say: "Мұнда жүздеген жол бар. Қайсысымен жүремін?" },
        { bg: "city", who: "server", mood: "explain", say: "Мен маршрутизатормын. Мекенжайыңа қарап, ең жақсы келесі қадамды айтамын. Бүкіл жолды білмеймін, тек келесі қадамды.", board: "мекенжай 85.x.x.x → оңтүстік-шығыс арнасы" },
        { bg: "space", who: "packet", mood: "confused", say: "Жердегі кабель бітеліп қалды… Ал менің досым №1048 спутник арқылы басқа жолмен ұшып кетті!", sfx: "ТЫҚ" },
        { scene: "АЛМАТЫ · СЕРВЕР", bg: "server-room", who: "server", mood: "smile", say: "Пакеттер әртүрлі жолмен, әртүрлі ретпен келді. Нөмірлері бойынша қайта құрамын: сурет толық!", with: ["packet"] },
        { bg: "server-room", who: "ustaz", mood: "explain", say: "Бөлу, мекенжай, нөмір: интернеттің бүкіл сиқыры осы. Бір пакет жоғалса, тек соны қайта сұраймыз." },
      ],
    },
  },
  {
    id: "tired-server",
    labId: "cloud",
    lessonId: "cloud-2-orchestration",
    comic: {
      title: "Шаршаған сервер",
      genre: "Тірі заттар",
      tagline: "Бір сервер бүкіл мектепке қызмет етті. Бір күні ол құлады.",
      panels: [
        { scene: "СЕРВЕР БӨЛМЕСІ · ДҮЙСЕНБІ 08:00", bg: "server-room", who: "server", mood: "smile", say: "Қайырлы таң! Мен мектеп сайтымын. Бүгін де сұраныстарға жауап беремін." },
        { bg: "server-room", who: "server", mood: "confused", say: "Кесте жарияланды… 2000 оқушы бір мезгілде кірді! Жадым толды, баяулап барамын…", sfx: "УУУФ" },
        { bg: "server-room", who: "server", mood: "wow", say: "Мен… құлап…", sfx: "ТАРС!" },
        { scene: "ДӘЛ СОЛ СӘТ", bg: "server-room", who: "robot", mood: "explain", say: "Мен оркестратормын. Ереже: «3 сервер жұмыс істеуі керек». Біреуі құлады, айырманы түзетемін.", board: "қалаған күй: 3 · нақты: 2 → жаңасын қос" },
        { bg: "server-room", who: "robot", mood: "smile", say: "Жүктеме көп пе? Онда тағы екі көшірме қосамын. Сұраныстарды бәріне бөліп беремін.", with: ["server", "server"] },
        { bg: "server-room", who: "server", mood: "wow", say: "Енді бізбіз бесеуміз! Әрқайсымызға 400 сұраныс: оңай!" },
        { bg: "classroom", who: "ustaz", mood: "smile", say: "Бір мықты серверге сенбей, көп кішкентай серверді бақылаушыға береміз. Бұл бұлттың басты идеясы." },
      ],
    },
  },
  {
    id: "virus-trick",
    labId: "sec",
    lessonId: "sec-1-caesar",
    comic: {
      title: "Вирустың айласы",
      genre: "Тірі заттар",
      tagline: "Ол есікті бұзбайды. Ол есікті өзіңе аштырады.",
      panels: [
        { scene: "ТҮН · КОМПЬЮТЕР ІШІ", bg: "night", who: "virus", mood: "smile", say: "Хе-хе. Брандмауэрді бұзу қиын. Бірақ адамды алдау оңай…" },
        { bg: "room", who: "computer", mood: "think", say: "Жаңа хат келді: «Құттықтаймыз! Сіз телефон ұттыңыз. Мына сілтемеге кіріп, құпиясөзіңізді енгізіңіз»." },
        { bg: "room", who: "mustafa", mood: "wow", say: "Телефон?! Қазір кіремін!", with: ["computer"] },
        { bg: "room", who: "nuray", mood: "explain", say: "Тоқта! Мекенжайына қара: «kaspi-bonus-kz.xyz». Нағыз банк мұндай сілтеме жібермейді.", sfx: "СТОП!" },
        { bg: "night", who: "virus", mood: "confused", say: "Ах, ұсталдым! Құпиясөз ұрлау жоспарым сәтсіз болды…" },
        { bg: "classroom", who: "ustaz", mood: "explain", say: "Бұл фишинг. Шабуылшылар көбіне техниканы емес, адамның асығыстығы мен қызығушылығын пайдаланады.", board: "1. сілтеменің мекенжайын тексер\n2. құпиясөзді хатпен сұрамайды\n3. асықтырса, күдіктен" },
        { bg: "room", who: "computer", mood: "smile", say: "Рақмет, Нұрай. Ең мықты антивирус: ойланып басатын адам." },
      ],
    },
  },
  {
    id: "phone-search",
    labId: "algo",
    lessonId: "algo-1-search",
    comic: {
      title: "Телефон суретті іздейді",
      genre: "Тірі заттар",
      tagline: "10 000 сурет. Нұрай біреуін ғана іздеп тұр.",
      panels: [
        { scene: "ҮЗІЛІС · МЕКТЕП АУЛАСЫ", bg: "city", who: "nuray", mood: "think", say: "Телефон, былтырғы 1 қыркүйектегі суретті тапшы." },
        { bg: "city", who: "phone", mood: "confused", say: "Он мың сурет бар… Біріншісінен бастап бәрін бір-бірлеп қарап шығайын ба?" },
        { scene: "ТЕЛЕФОННЫҢ ЖАДЫ", bg: "circuit", who: "cpu", mood: "explain", say: "Тоқта! Суреттер күні бойынша реттелген ғой. Ортасынан ашайық: 1 қыркүйек одан бұрын ба, кейін бе?", board: "10 000 → 5 000 → 2 500 → … → 1\nбар болғаны 14 қадам" },
        { bg: "circuit", who: "phone", mood: "think", say: "Әр қадамда жартысы түсіп қалады екен. Бұрын, кейін, бұрын…" },
        { bg: "circuit", who: "phone", mood: "wow", say: "Таптым! 14 қадам, он мыңның орнына!", sfx: "ДИҢ!" },
        { bg: "city", who: "nuray", mood: "wow", say: "Бір секунд та өтпеді! Ал суреттер реттелмеген болса ше?", with: ["phone"] },
        { bg: "classroom", who: "ustaz", mood: "smile", say: "Онда екілік іздеу жұмыс істемейді. Сондықтан деректерді ретке қою құны көп кейін қайтады." },
      ],
    },
  },
  {
    id: "robot-learns",
    labId: "ai",
    lessonId: "ai-1-data",
    comic: {
      title: "Робот мысықты таниды",
      genre: "Тірі заттар",
      tagline: "Оған ешкім ереже жазған жоқ. Ол мысалдардан үйренді.",
      panels: [
        { scene: "1-КҮН · ЗЕРТХАНА", bg: "classroom", who: "robot", mood: "confused", say: "Маған сурет көрсетті. Бұл мысық па, ит пе? Мен білмеймін. Кездейсоқ айтамын: ит." },
        { bg: "classroom", who: "mustafa", mood: "smile", say: "Қате! Бұл мысық. Міне, тағы мың сурет, әрқайсысында дұрыс жауабы бар.", with: ["robot"] },
        { scene: "7-КҮН", bg: "circuit", who: "robot", mood: "think", say: "Әр қатеден кейін ішімдегі салмақтарды сәл түзетемін. Құлақ, мұрт, көздің пішіні… бірте-бірте маңызды белгілерді табамын.", board: "қате → салмақты түзету → қайта көру\n1000 мысал × 10 айналым" },
        { scene: "30-КҮН", bg: "classroom", who: "robot", mood: "wow", say: "Мысық! Ит! Мысық! 95% дұрыс!", sfx: "БИП!" },
        { bg: "classroom", who: "nuray", mood: "think", say: "Ал мен оған тек ақ мысықтарды көрсетсем ше?" },
        { bg: "classroom", who: "robot", mood: "confused", say: "Онда қара мысықты… ит деп ойлауым мүмкін. Мен тек көрген нәрсемнен үйренемін.", sfx: "?!" },
        { bg: "classroom", who: "ustaz", mood: "explain", say: "Модель деректен үйренеді, сондықтан деректің әртүрлілігі мен тазалығы бәрін шешеді. Деректе бұрмалау болса, модельде де болады." },
      ],
    },
  },
];
