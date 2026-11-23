"use client";

import type { Backdrop, Gadget, Mood } from "@inside-tech/lesson-engine";

/**
 * The living things of the stories, drawn in SVG: a laptop, a computer, a server, a processor,
 * a network packet, a robot, a phone and a virus. Each has a face that shows a mood. And the
 * places they live in, drawn behind a panel.
 */

const INK = "#1b1410";

/** Eyes, brows and mouth, drawn for a 60×60 face centred at (30, 33), then moved onto a body. */
function Features({ mood, cx, cy, s, light = false }: { mood: Mood; cx: number; cy: number; s: number; light?: boolean }) {
  const c = light ? "#f5f3e7" : INK;
  const mouth =
    mood === "wow" ? (
      <ellipse cx="30" cy="42" rx="3.4" ry="4.2" fill={c} />
    ) : mood === "confused" ? (
      <path d="M24 43 q3 -3 6 0 t6 0" stroke={c} strokeWidth="2.2" fill="none" />
    ) : mood === "think" ? (
      <path d="M26 43 h8" stroke={c} strokeWidth="2.2" />
    ) : mood === "explain" ? (
      <path d="M24 40 q6 7 12 0 z" fill={c} />
    ) : (
      <path d="M24 41 q6 5 12 0" stroke={c} strokeWidth="2.2" fill="none" />
    );
  const brows =
    mood === "confused" ? (
      <path d="M19 26 l7 -2 M34 23 l7 3" stroke={c} strokeWidth="2" />
    ) : mood === "wow" ? (
      <path d="M19 23 q4 -3 8 0 M33 23 q4 -3 8 0" stroke={c} strokeWidth="2" fill="none" />
    ) : mood === "think" ? (
      <path d="M19 25 l8 1 M33 26 l8 -1" stroke={c} strokeWidth="2" />
    ) : null;
  return (
    <g transform={`translate(${cx - 30 * s} ${cy - 33 * s}) scale(${s})`}>
      <circle cx="24" cy="31" r={mood === "wow" ? 2.6 : 2.1} fill={c} />
      <circle cx="36" cy="31" r={mood === "wow" ? 2.6 : 2.1} fill={c} />
      {brows}
      {mouth}
    </g>
  );
}

export function GadgetFace({ who, mood = "smile", className }: { who: Gadget; mood?: Mood; className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      {who === "laptop" && (
        <>
          <rect x="9" y="8" width="42" height="31" rx="3" fill="#2b2f3a" stroke={INK} strokeWidth="1.4" />
          <rect x="12.5" y="11.5" width="35" height="24" rx="1.5" fill="#cfeaff" />
          <path d="M4 40 h52 l-5 9 h-42 z" fill="#9aa3b5" stroke={INK} strokeWidth="1.4" />
          <path d="M24 44 h12" stroke="#6b7385" strokeWidth="1.6" />
          <Features mood={mood} cx={30} cy={24} s={0.62} />
        </>
      )}
      {who === "computer" && (
        <>
          <rect x="7" y="5" width="46" height="34" rx="3" fill="#e9e4d6" stroke={INK} strokeWidth="1.4" />
          <rect x="11" y="9" width="38" height="26" rx="1.5" fill="#1f3b2e" />
          <path d="M26 39 h8 l2 8 h-12 z" fill="#c9c2b0" stroke={INK} strokeWidth="1.2" />
          <rect x="17" y="47" width="26" height="5" rx="2" fill="#c9c2b0" stroke={INK} strokeWidth="1.2" />
          <circle cx="47" cy="37" r="1" fill="#2ecc71" />
          <Features mood={mood} cx={30} cy={23} s={0.62} light />
        </>
      )}
      {who === "server" && (
        <>
          <rect x="15" y="3" width="30" height="54" rx="3" fill="#3a4152" stroke={INK} strokeWidth="1.4" />
          <rect x="18" y="8" width="24" height="19" rx="2" fill="#ffe9a8" />
          {[32, 39, 46].map((y) => (
            <g key={y}>
              <rect x="18" y={y} width="24" height="5" rx="1" fill="#2a3040" />
              <circle cx="22" cy={y + 2.5} r="1.2" fill={y === 39 ? "#f1c40f" : "#2ecc71"} />
              <path d={`M26 ${y + 2.5} h12`} stroke="#5d6680" strokeWidth="1.2" />
            </g>
          ))}
          <Features mood={mood} cx={30} cy={18.5} s={0.5} />
        </>
      )}
      {who === "cpu" && (
        <>
          {[16, 22, 28, 34, 40, 46].map((p) => (
            <g key={p} stroke="#c9a24a" strokeWidth="1.6">
              <path d={`M${p} 6 v6 M${p} 48 v6 M6 ${p} h6 M48 ${p} h6`} />
            </g>
          ))}
          <rect x="11" y="11" width="38" height="38" rx="3" fill="#4b5262" stroke={INK} strokeWidth="1.4" />
          <rect x="17" y="17" width="26" height="26" rx="2" fill="#d6d9e0" />
          <Features mood={mood} cx={30} cy={30} s={0.6} />
        </>
      )}
      {who === "packet" && (
        <>
          <path d="M22 50 l-3 7 M38 50 l3 7" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <rect x="7" y="16" width="46" height="34" rx="3" fill="#fff5d6" stroke={INK} strokeWidth="1.4" />
          <path d="M7 18 l23 16 l23 -16" stroke="#c9a24a" strokeWidth="1.4" fill="none" />
          <rect x="38" y="20" width="11" height="8" fill="#e2473a" />
          <Features mood={mood} cx={30} cy={38} s={0.58} />
        </>
      )}
      {who === "robot" && (
        <>
          <path d="M30 12 v-6" stroke={INK} strokeWidth="2" />
          <circle cx="30" cy="5" r="3" fill="#e2473a" stroke={INK} strokeWidth="1.2" />
          <rect x="12" y="12" width="36" height="32" rx="7" fill="#a9c4ff" stroke={INK} strokeWidth="1.4" />
          <rect x="8" y="22" width="4" height="12" rx="2" fill="#7f9ce0" stroke={INK} strokeWidth="1" />
          <rect x="48" y="22" width="4" height="12" rx="2" fill="#7f9ce0" stroke={INK} strokeWidth="1" />
          <rect x="20" y="46" width="20" height="10" rx="3" fill="#7f9ce0" stroke={INK} strokeWidth="1.2" />
          <Features mood={mood} cx={30} cy={28} s={0.7} />
        </>
      )}
      {who === "phone" && (
        <>
          <rect x="17" y="3" width="26" height="54" rx="6" fill="#23252d" stroke={INK} strokeWidth="1.4" />
          <rect x="20" y="9" width="20" height="40" rx="2" fill="#d8e2ff" />
          <rect x="26" y="5" width="8" height="2" rx="1" fill="#555" />
          <Features mood={mood} cx={30} cy={27} s={0.5} />
        </>
      )}
      {who === "virus" && (
        <>
          {Array.from({ length: 10 }, (_, k) => {
            const a = (k * Math.PI) / 5;
            return (
              <g key={k}>
                <path d={`M${30 + Math.cos(a) * 14} ${32 + Math.sin(a) * 14} L${30 + Math.cos(a) * 22} ${32 + Math.sin(a) * 22}`} stroke="#3f8f2f" strokeWidth="2.4" />
                <circle cx={30 + Math.cos(a) * 23} cy={32 + Math.sin(a) * 23} r="2.6" fill="#c64fd6" stroke={INK} strokeWidth="0.8" />
              </g>
            );
          })}
          <circle cx="30" cy="32" r="15" fill="#7fd36b" stroke={INK} strokeWidth="1.4" />
          <Features mood={mood} cx={30} cy={32} s={0.72} />
        </>
      )}
    </svg>
  );
}

/** A place behind a panel. Flat shapes, low contrast, so speech stays readable on top. */
export function BackdropArt({ kind, className }: { kind: Backdrop; className?: string }) {
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {kind === "room" && (
        <>
          <rect width="400" height="220" fill="#f3e6cf" />
          <rect x="250" y="24" width="110" height="80" fill="#bfe3f7" stroke="#8a6a46" strokeWidth="5" />
          <path d="M305 24 v80 M250 64 h110" stroke="#8a6a46" strokeWidth="4" />
          <circle cx="330" cy="46" r="10" fill="#ffe08a" />
          <rect y="160" width="400" height="60" fill="#c99a6b" />
          <rect x="30" y="140" width="190" height="10" fill="#8a5a2b" />
          <path d="M50 150 v40 M200 150 v40" stroke="#8a5a2b" strokeWidth="6" />
          <path d="M40 120 q10 -30 20 0 M48 118 q12 -36 24 0" fill="#3f8f2f" />
          <rect x="44" y="120" width="22" height="20" fill="#c0392b" />
        </>
      )}
      {kind === "server-room" && (
        <>
          <rect width="400" height="220" fill="#151a26" />
          {[20, 100, 180, 260, 340].map((x) => (
            <g key={x}>
              <rect x={x} y="30" width="56" height="170" fill="#232a3a" stroke="#2f3850" strokeWidth="2" />
              {[45, 70, 95, 120, 145, 170].map((y, k) => (
                <g key={y}>
                  <rect x={x + 6} y={y} width="44" height="14" fill="#1a2030" />
                  <circle cx={x + 12} cy={y + 7} r="2.5" fill={(x + k) % 3 === 0 ? "#f1c40f" : "#2ecc71"} />
                  <circle cx={x + 20} cy={y + 7} r="2.5" fill="#3498db" opacity="0.7" />
                </g>
              ))}
            </g>
          ))}
          <rect y="200" width="400" height="20" fill="#0d111a" />
        </>
      )}
      {kind === "circuit" && (
        <>
          <rect width="400" height="220" fill="#1f5c3f" />
          <g stroke="#d4af37" strokeWidth="3" fill="none" opacity="0.7">
            <path d="M0 40 h90 v40 h120 v-30 h190" />
            <path d="M0 150 h60 v-30 h110 v60 h230" />
            <path d="M140 0 v60 M260 220 v-70 h60 v-60" />
          </g>
          {[
            [90, 80],
            [210, 50],
            [170, 180],
            [320, 90],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#d4af37" />
          ))}
          <rect x="230" y="110" width="60" height="44" fill="#2b2f3a" stroke="#888" strokeWidth="2" />
          <rect x="40" y="60" width="34" height="20" fill="#2b2f3a" stroke="#888" strokeWidth="2" />
        </>
      )}
      {kind === "city" && (
        <>
          <rect width="400" height="220" fill="#f7b267" />
          <rect width="400" height="110" fill="#f79d65" />
          <circle cx="320" cy="70" r="28" fill="#ffe08a" />
          {[
            [10, 90, 50],
            [70, 60, 40],
            [120, 110, 60],
            [190, 40, 45],
            [245, 80, 55],
            [310, 100, 40],
            [355, 70, 45],
          ].map(([x, h, w]) => (
            <rect key={x} x={x} y={220 - h! - 40} width={w} height={h! + 40} fill="#3d2c4f" />
          ))}
          <path d="M210 40 v-30 M205 16 h10" stroke="#3d2c4f" strokeWidth="3" />
          <path d="M0 200 q100 -30 200 0 t200 0" stroke="#2a1f38" strokeWidth="2" fill="none" />
        </>
      )}
      {kind === "space" && (
        <>
          <rect width="400" height="220" fill="#0b1026" />
          {Array.from({ length: 40 }, (_, k) => (
            <circle key={k} cx={(k * 97) % 400} cy={(k * 53) % 220} r={k % 5 === 0 ? 1.8 : 1} fill="#fff" opacity="0.8" />
          ))}
          <circle cx="330" cy="170" r="70" fill="#c2553d" />
          <circle cx="300" cy="150" r="10" fill="#a8432f" />
          <circle cx="350" cy="190" r="14" fill="#a8432f" />
          <circle cx="60" cy="50" r="22" fill="#3b82c4" />
          <g transform="translate(170 70) rotate(-20)">
            <rect x="-6" y="-6" width="12" height="12" fill="#ccc" />
            <rect x="-30" y="-4" width="22" height="8" fill="#3a6fd8" />
            <rect x="8" y="-4" width="22" height="8" fill="#3a6fd8" />
          </g>
        </>
      )}
      {kind === "classroom" && (
        <>
          <rect width="400" height="220" fill="#efe2c4" />
          <rect x="60" y="20" width="280" height="110" fill="#24453a" stroke="#8a5a2b" strokeWidth="8" />
          <path d="M90 60 h80 M90 85 h140" stroke="#f5f3e7" strokeWidth="3" opacity="0.6" />
          <rect y="175" width="400" height="45" fill="#b88a5a" />
          {[40, 170, 300].map((x) => (
            <rect key={x} x={x} y="160" width="70" height="12" fill="#8a5a2b" />
          ))}
        </>
      )}
      {kind === "night" && (
        <>
          <rect width="400" height="220" fill="#14213d" />
          <circle cx="330" cy="50" r="24" fill="#f4f1de" />
          <circle cx="320" cy="44" r="24" fill="#14213d" />
          {Array.from({ length: 24 }, (_, k) => (
            <circle key={k} cx={(k * 71) % 400} cy={(k * 37) % 120} r="1.2" fill="#fff" opacity="0.8" />
          ))}
          <path d="M40 220 v-70 l50 -35 l50 35 v70 z" fill="#2a3756" />
          <rect x="70" y="170" width="18" height="18" fill="#ffd166" />
          <rect x="100" y="170" width="18" height="18" fill="#ffd166" opacity="0.5" />
          <path d="M200 220 v-90 h80 v90" fill="#22304d" />
          <rect x="215" y="150" width="14" height="14" fill="#ffd166" />
        </>
      )}
    </svg>
  );
}
