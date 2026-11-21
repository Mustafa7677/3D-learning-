import styles from "./landing.module.css";

/** Deterministic pseudo-random numbers, so server and client draw the same art. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** AI: a neural field, layers of neurons receding into depth with live connections. */
function NeuralField() {
  const r = rng(7);
  const layers = Array.from({ length: 7 }, (_, l) => {
    const n = 9 - Math.abs(3 - l);
    const x = 40 + l * 88;
    const scale = 0.55 + l * 0.08;
    return Array.from({ length: n }, (_, k) => ({ x: x + (r() - 0.5) * 12, y: 200 + (k - (n - 1) / 2) * 44 * scale, hot: r() > 0.78 }));
  });
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className={styles.keyArt} aria-hidden>
      <defs>
        <radialGradient id="ka-ai" cx="70%" cy="50%" r="60%">
          <stop offset="0" stopColor="#7696ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7696ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="400" fill="url(#ka-ai)" />
      {layers.slice(0, -1).map((a, l) =>
        a.flatMap((p, i) =>
          layers[l + 1]!.filter((_, j) => (i + j + l) % 3 === 0).map((q, j) => (
            <line key={`${l}-${i}-${j}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={p.hot && q.hot ? styles.kaHot : styles.kaLine} />
          )),
        ),
      )}
      {layers.flat().map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.hot ? 5 : 3} className={p.hot ? styles.kaNodeHot : styles.kaNode} />
      ))}
    </svg>
  );
}

/** Cybersecurity: an encrypted data world, a wall of ciphertext with one decoded line. */
function CipherWall() {
  const r = rng(42);
  const hex = "0123456789ABCDEF";
  const rows = Array.from({ length: 14 }, () => Array.from({ length: 22 }, () => hex[Math.floor(r() * 16)]! + hex[Math.floor(r() * 16)]!).join(" "));
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className={styles.keyArt} aria-hidden>
      <defs>
        <linearGradient id="ka-sec" x1="0" x2="1">
          <stop offset="0" stopColor="#b07cff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#b07cff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#b07cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(330 -40) skewY(-12)">
        {rows.map((t, i) => (
          <text key={i} x={0} y={30 + i * 30} className={i === 7 ? styles.kaPlain : styles.kaCipher}>
            {i === 7 ? "ТЕХНОЛОГИЯНЫҢ ІШІНЕ КІР" : t}
          </text>
        ))}
        <rect x={-12} y={30 + 6 * 30 + 8} width={420} height={30} fill="url(#ka-sec)" />
      </g>
    </svg>
  );
}

/** Robotics: an industrial mechanism, meshing gears driving an arm. */
function Mechanism() {
  const gear = (cx: number, cy: number, rad: number, teeth: number, hot = false) => {
    const pts: string[] = [];
    for (let k = 0; k < teeth * 2; k++) {
      const a = (k / (teeth * 2)) * Math.PI * 2;
      const rr = k % 2 === 0 ? rad : rad * 0.84;
      const a2 = a + Math.PI / (teeth * 2);
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`, `${(cx + Math.cos(a2) * rr).toFixed(1)},${(cy + Math.sin(a2) * rr).toFixed(1)}`);
    }
    return (
      <g className={hot ? styles.kaGearHot : styles.kaGear}>
        <polygon points={pts.join(" ")} />
        <circle cx={cx} cy={cy} r={rad * 0.32} />
        <circle cx={cx} cy={cy} r={rad * 0.1} />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className={styles.keyArt} aria-hidden>
      {gear(470, 250, 90, 18)}
      {gear(590, 140, 58, 12, true)}
      {gear(372, 120, 44, 10)}
      <g className={styles.kaArm}>
        <path d="M300 380 L300 330 L380 300 L470 200 L560 180" />
        <circle cx={380} cy={300} r={10} />
        <circle cx={470} cy={200} r={10} />
        <path d="M560 180 l22 -14 M560 180 l22 14" />
      </g>
    </svg>
  );
}

export function KeyArt({ labId }: { labId: string }) {
  if (labId === "ai") return <NeuralField />;
  if (labId === "sec") return <CipherWall />;
  if (labId === "iot") return <Mechanism />;
  return null;
}

export const hasKeyArt = (labId: string) => labId === "ai" || labId === "sec" || labId === "iot";
