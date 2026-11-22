"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color } from "three";
import { A, USERS, attempt, bitDistance, cipherText, frequencies, sha256, stored, strength, utf8, xorBytes, type SecLabState } from "@inside-tech/lab-sec";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { BlocksView, CertsView, CspView, DhView, MacView, TimingView } from "./SecMiddleViews";
import { C0, C1 } from "./palette";

export type SecFocus = "cipher" | "xor" | "hash" | "passwords" | "strength" | "rsa" | "attack" | "blocks" | "mac" | "dh" | "certs" | "csp" | "timing";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const short = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Wheel({ state }: { state: SecLabState }) {
  const c = state.cipher;
  const shift = c.source === "own" ? c.shift : c.guess;
  const freq = useMemo(() => frequencies(cipherText(state)), [state]);
  const max = Math.max(1, ...freq);
  const ring = (r: number, offset: number, color: Color, size: number) =>
    A.map((ch, i) => {
      const a = ((i - offset) / A.length) * Math.PI * 2 - Math.PI / 2;
      return <Label key={`${r}-${i}`} text={ch} position={[Math.cos(a) * r, 0.3, Math.sin(a) * r]} size={size} />;
    });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[3.6, 4.6, 84]} />
        <meshStandardMaterial color={C0} transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.4, 3.4, 84]} />
        <meshStandardMaterial color={C1} transparent opacity={0.22} />
      </mesh>
      {ring(4.1, 0, C0, 0.32)}
      {ring(2.9, -shift, C1, 0.3)}
      <Label text={c.source === "own" ? `Кілт: ${shift}` : `Болжам: ${shift}`} position={[0, 0.6, 0]} size={0.45} />
      <Label text={`шифр: ${short(cipherText(state))}`} position={[0, 0.4, -5.4]} size={0.36} />
      <Label text={`ашылғаны: ${short(attempt(state))}`} position={[0, 0.4, -6.1]} size={0.36} />
      {c.showFreq && (
        <group position={[-6.3, 0, 5.4]}>
          {freq.map((f, i) => (
            <group key={i} position={[i * 0.3, 0, 0]}>
              <mesh position={[0, 0.05 + (f / max) * 1.5, 0]}>
                <boxGeometry args={[0.24, 0.1 + (f / max) * 3, 0.24]} />
                <meshStandardMaterial color={f === max ? C1 : C0} />
              </mesh>
              {f === max && <Label text={`${A[i]} (${i})`} position={[0, 3.6, 0]} size={0.32} />}
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function Bits({ bytes, z, label, highlight }: { bytes: Uint8Array; z: number; label: string; highlight?: Color }) {
  const n = Math.min(bytes.length, 16);
  return (
    <group position={[0, 0, z]}>
      <Label text={label} position={[-7.6, 0.4, 0]} size={0.3} />
      {Array.from({ length: n }, (_, b) =>
        Array.from({ length: 8 }, (_, i) => {
          const on = (bytes[b]! >> (7 - i)) & 1;
          return (
            <mesh key={`${b}-${i}`} position={[-6 + b * 0.82 + i * 0.09, on ? 0.2 : 0.06, 0]}>
              <boxGeometry args={[0.08, on ? 0.4 : 0.12, 0.3]} />
              <meshStandardMaterial color={on ? (highlight ?? C1) : OFF} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function XorView({ state }: { state: SecLabState }) {
  const m = utf8(state.xor.message);
  const k = utf8(state.xor.key || " ");
  const keyFull = m.map((_, i) => k[i % k.length]!);
  const c = xorBytes(m, k);
  return (
    <group>
      <Bits bytes={m} z={-1.5} label="хабар" />
      <Bits bytes={keyFull} z={0} label={k.length < m.length ? "кілт (қайталанады!)" : "кілт"} highlight={k.length < m.length ? BAD : C0} />
      <Bits bytes={c} z={1.5} label="⊕ шифр" highlight={OK} />
      <Label text={`${m.length} байт хабар · ${k.length} байт кілт`} position={[0, 1.6, -2.6]} size={0.36} />
    </group>
  );
}

function HashView({ state }: { state: SecLabState }) {
  const h = sha256(state.hash.input);
  const prev = state.hash.previous === null ? null : sha256(state.hash.previous);
  const bit = (hex: string, i: number) => (parseInt(hex[i >> 2]!, 16) >> (3 - (i & 3))) & 1;
  return (
    <group>
      {Array.from({ length: 256 }, (_, i) => {
        const on = bit(h, i);
        const flipped = prev !== null && bit(prev, i) !== on;
        return (
          <mesh key={i} position={[-3.75 + (i % 16) * 0.5, on ? 0.18 : 0.05, -3.75 + Math.floor(i / 16) * 0.5]}>
            <boxGeometry args={[0.42, on ? 0.36 : 0.1, 0.42]} />
            <meshStandardMaterial color={flipped ? C1 : on ? C0 : OFF} />
          </mesh>
        );
      })}
      <Label text={`«${short(state.hash.input, 24)}»`} position={[0, 1.6, -4.6]} size={0.36} />
      <Label text={`${h.slice(0, 32)}`} position={[0, 1.1, 4.6]} size={0.3} />
      <Label text={`${h.slice(32)}`} position={[0, 0.7, 4.6]} size={0.3} />
      {prev !== null && <Label text={`Өзгерген бит: ${bitDistance(prev, h)} / 256`} position={[0, 2.2, -4.6]} size={0.4} />}
    </group>
  );
}

function PasswordsView({ state }: { state: SecLabState }) {
  const p = state.passwords;
  const cracked = new Map((p.lastCrack?.cracked ?? []).map((c) => [c.name, c.password]));
  return (
    <group>
      {USERS.map((u, i) => {
        const hit = cracked.get(u.name);
        return (
          <group key={u.name} position={[0, 0, -3 + i * 1.5]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[11, 0.6, 1.1]} />
              <meshStandardMaterial color={hit ? BAD : p.lastCrack ? OK : OFF} transparent opacity={0.6} />
            </mesh>
            <Label text={`${u.name}: ${short(stored(u, p.storage), 30)}`} position={[-1, 0.95, 0]} size={0.32} />
            {hit && <Label text={`бұзылды → ${hit}`} position={[4, 0.95, 0]} size={0.3} />}
          </group>
        );
      })}
      {p.lastCrack && <Label text={`Шабуылшы: ${p.lastCrack.work.toLocaleString("ru-RU")} хэш · ${p.lastCrack.cracked.length}/5 бұзылды`} position={[0, 2, -4.4]} size={0.42} />}
    </group>
  );
}

function StrengthView({ state }: { state: SecLabState }) {
  const pw = state.passwords.candidate;
  const s = pw ? strength(pw) : null;
  const h = s ? Math.min(8, s.bits / 16) : 0;
  return (
    <group>
      {[40, 60, 80, 100].map((b) => (
        <group key={b} position={[0, b / 16, 0]}>
          <mesh>
            <boxGeometry args={[4, 0.03, 0.03]} />
            <meshStandardMaterial color={OFF} />
          </mesh>
          <Label text={`${b} бит`} position={[-2.6, 0, 0]} size={0.3} />
        </group>
      ))}
      <mesh position={[0.4, h / 2, 0]}>
        <boxGeometry args={[1.2, Math.max(0.05, h), 1.2]} />
        <meshStandardMaterial color={!s ? OFF : s.inDictionary || s.bits < 40 ? BAD : s.bits < 60 ? C1 : OK} />
      </mesh>
      <Label text={s ? `${s.bits.toFixed(1)} бит${s.inDictionary ? " · сөздікте!" : ""}` : "Құпиясөз енгіз"} position={[0.4, h + 0.6, 0]} size={0.4} />
    </group>
  );
}

function Node({ x, z = 0, color, label, size = 0.5 }: { x: number; z?: number; color: Color; label: string; size?: number }) {
  return (
    <group position={[x, 0.5, z]}>
      <mesh>
        <sphereGeometry args={[size, 24, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Label text={label} position={[0, size + 0.45, 0]} size={0.36} />
    </group>
  );
}

function RsaView({ state }: { state: SecLabState }) {
  const r = state.rsa;
  const k = r.keys;
  return (
    <group>
      <Node x={-4.5} color={C0} label={`m = ${r.message}`} />
      <Node x={0} color={r.cipher === null ? OFF : C1} label={`c = ${r.cipher ?? "?"}`} />
      <Node x={4.5} color={r.decrypted === null ? OFF : r.decrypted === r.message ? OK : BAD} label={`m' = ${r.decrypted ?? "?"}`} />
      <Label text={k ? `ашық кілт (e = ${k.e}, n = ${k.n}) →` : "Кілттер жұбын жаса"} position={[-2.25, 1.6, 1.4]} size={0.32} />
      <Label text={k ? `← жабық кілт (d = ${k.d})` : r.error ?? ""} position={[2.25, 1.6, 1.4]} size={0.32} />
      {r.signature !== null && <Label text={`қолтаңба s = ${r.signature} → тексеру: ${r.verified} ${r.verified === r.message ? "✓" : "✗"}`} position={[0, 2.6, -1]} size={0.36} />}
      {k && <Label text={`n = ${k.p} × ${k.q},  φ(n) = ${k.phi}`} position={[0, 0.3, 2.6]} size={0.34} />}
    </group>
  );
}

function AttackView({ state }: { state: SecLabState }) {
  const a = state.attack;
  const last = a.last;
  const latest = a.posted[a.posted.length - 1];
  const ranScript = latest && !latest.escaped && /<\s*script|on\w+\s*=|javascript:/i.test(latest.text);
  return (
    <group>
      <Node x={-5} color={C0} label="Браузер" size={0.6} />
      <Node x={0} color={last?.injected ? BAD : OFF} label={a.parameterized ? "Сервер (параметрлер)" : "Сервер (жапсыру)"} size={0.6} />
      <Node x={5} color={last ? (last.ok ? (last.injected ? BAD : OK) : OFF) : OFF} label="Дерекқор" size={0.6} />
      {last && <Label text={short(last.query, 60)} position={[0, 2.4, 0]} size={0.3} />}
      {last && <Label text={last.ok ? `Кірді: ${last.as}${last.injected ? ": INJECTION!" : ""}` : "Кіру сәтсіз"} position={[0, 3, 0]} size={0.4} />}
      {latest && (
        <group position={[0, 0, 3]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[9, 0.6, 1.4]} />
            <meshStandardMaterial color={ranScript ? BAD : OK} transparent opacity={0.5} />
          </mesh>
          <Label text={ranScript ? "⚠ Скрипт орындалды: cookie ұрланды" : `Пікір: ${short(latest.text, 40)}`} position={[0, 1, 0]} size={0.36} />
        </group>
      )}
    </group>
  );
}

function Contents({ state, focus }: { state: SecLabState; focus: SecFocus }) {
  const frame: Record<SecFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
    cipher: { w: 14, h: 15, t: [0, 0, 0], d: [0, 2.2, 1] },
    xor: { w: 16, h: 7, t: [0, 0, 0], d: [0, 1.8, 1] },
    hash: { w: 10, h: 11, t: [0, 0, 0], d: [0, 2.2, 1] },
    passwords: { w: 13, h: 10, t: [0, 0, 0], d: [0, 1.8, 1] },
    strength: { w: 8, h: 8, t: [0, 3, 0], d: [0, 0.4, 1] },
    rsa: { w: 12, h: 7, t: [0, 0.8, 0.5], d: [0, 1, 1] },
    attack: { w: 13, h: 9, t: [0, 0.8, 1], d: [0, 1.3, 1] },
    blocks: { w: 12, h: 7, t: [0, 0, 0.2], d: [0, 1.6, 1] },
    mac: { w: 13, h: 5, t: [0, 0.5, 0.5], d: [0, 0.5, 1] },
    dh: { w: 13, h: 6.5, t: [0, 1, 0.8], d: [0, 0.6, 1] },
    certs: { w: 8, h: 7, t: [0, 2.6, 0], d: [0, 0.25, 1] },
    csp: { w: 13, h: 5, t: [0, 1, 0.5], d: [0, 0.5, 1] },
    timing: { w: 13, h: 7, t: [0.4, 0.8, 0], d: [0, 0.9, 1] },
  };
  const f = frame[focus];
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.2} />
      <gridHelper args={[24, 24, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />
      <StageLook />
      {focus === "cipher" && <Wheel state={state} />}
      {focus === "xor" && <XorView state={state} />}
      {focus === "hash" && <HashView state={state} />}
      {focus === "passwords" && <PasswordsView state={state} />}
      {focus === "strength" && <StrengthView state={state} />}
      {focus === "rsa" && <RsaView state={state} />}
      {focus === "attack" && <AttackView state={state} />}
      {focus === "blocks" && <BlocksView state={state} />}
      {focus === "mac" && <MacView state={state} />}
      {focus === "dh" && <DhView state={state} />}
      {focus === "certs" && <CertsView state={state} />}
      {focus === "csp" && <CspView state={state} />}
      {focus === "timing" && <TimingView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function SecScene({ state, focus }: { state: SecLabState; focus: SecFocus }) {
  return (
    <Canvas camera={{ position: [0, 9, 12], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: киберқауіпсіздік">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}

