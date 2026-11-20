/** Kazakh texts for the cipher lessons (plaintexts the learner encrypts and attacks). */
export const SHORT_TEXT = "Кездесу сағат сегізде";

export const LONG_TEXT = `Алматы: Алатау баурайында орналасқан әдемі қала. Қаланың көшелері кең, саябақтары жасыл, ал таулары жыл бойы ақ қар жамылып тұрады. Ата-бабамыз бұл жерді алма бағының отаны деп атаған. Бүгінде мұнда жастар оқиды, ғалымдар жаңа технологиялар жасайды, ал бағдарламашылар әлемге таныс қосымшалар шығарады. Алматыда ауа райы жазда ыстық, қыста салқын, бірақ күн ашық болады. Таудағы Медеу мен Шымбұлақ қала тұрғындары мен қонақтардың ең сүйікті орындары. Кешке қала шамдары жанып, Көктөбе басынан қараған адамға бүкіл аңғар жарқырап көрінеді.`;

/** Problem-set plaintext (different from the lesson text so the answer cannot be remembered). */
export const PSET_TEXT = `Киберқауіпсіздік: ақпаратты рұқсатсыз қол жеткізуден, өзгертуден және жойылудан қорғау өнері. Шабуылшы әрқашан ең әлсіз буынды іздейді: қарапайым құпиясөзді, жаңартылмаған бағдарламаны немесе сенгіш адамды. Сондықтан қорғаныс бірнеше қабаттан тұруы керек. Шифрлау деректерді жасырады, хэш олардың өзгермегенін дәлелдейді, ал қолтаңба хабарды кім жібергенін растайды. Ең жақсы жүйе де адамның қатесінен құлауы мүмкін, сол себепті білім: басты қару.`;

export const PSET_SHIFT = 17;
/** Keys of the lesson challenges (hidden from the learner's view, not from the code). */
export const CHALLENGES = {
  short: { text: SHORT_TEXT, key: 23 },
  long: { text: LONG_TEXT, key: 9 },
  pset: { text: PSET_TEXT, key: PSET_SHIFT },
} as const;
export type ChallengeId = keyof typeof CHALLENGES;

/** The "official" release the learner verifies in the integrity step. */
export const RELEASE_TEXT = "INSIDE TECH v1.0";
