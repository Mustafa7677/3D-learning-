"use client";

import { useMemo } from "react";
import { Color } from "three";
import { BLOCK, IMG, picture, type SecLabState } from "@inside-tech/lab-sec";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const PLAIN = [new Color("#efe6d2"), new Color("#c9a24a"), new Color("#a3262a")];
const hue = (n: number) => new Color().setHSL(((n >>> 8) % 360) / 360, 0.55, 0.32 + ((n & 0xff) / 255) * 0.3);

function Grid({ colors, x, title }: { colors: Color[]; x: number; title: string }) {
  const s = 0.32;
  return (
    <group position={[x, 0, 0]}>
      {colors.map((c, i) => (
        <mesh key={i} position={[((i % IMG) - IMG / 2 + 0.5) * s, 0.06, (Math.floor(i / IMG) - IMG / 2 + 0.5) * s]}>
          <boxGeometry args={[s * 0.94, 0.12, s * 0.94]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <Label text={title} position={[0, 0.6, -IMG * s * 0.5 - 0.5]} size={0.4} />
    </group>
  );
}

export function BlocksView({ state }: { state: SecLabState }) {
  const plain = useMemo(() => picture().map((v) => PLAIN[v]!), []);
  const last = state.blocks.last;
  const cipher = useMemo(() => (last ? last.cipher.flatMap((c) => Array.from({ length: BLOCK }, () => hue(c))) : plain.map(() => OFF)), [last, plain]);
  return (
    <group>
      <Grid colors={plain} x={-3.1} title="Ашық сурет" />
      <Grid colors={cipher} x={3.1} title={last ? `${last.mode.toUpperCase()} шифры · ${new Set(last.cipher).size} түрлі блок` : "Әлі шифрланған жоқ"} />
    </group>
  );
}

function Node({ x, color, title, lines }: { x: number; color: Color; title: string; lines: string[] }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[2, 1.2, 1.4]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.5} />
      </mesh>
      <Label text={title} position={[0, 1.7, 0]} size={0.4} />
      {lines.map((l, i) => (
        <Label key={i} text={l} position={[0, -0.25 - i * 0.45, 1]} size={0.3} />
      ))}
    </group>
  );
}

export function MacView({ state }: { state: SecLabState }) {
  const m = state.mac;
  const last = m.last;
  const scheme = m.scheme === "none" ? "тегсіз" : m.scheme === "hash" ? "SHA-256" : "HMAC-SHA256";
  return (
    <group>
      <Node x={-4.5} color={C0} title="Қосымша" lines={["1000 ₸", scheme]} />
      <Node x={0} color={last?.tampered ? BAD : OFF} title="Шабуылшы" lines={last?.tampered ? ["9000 ₸", last.recomputed ? "тегті қайта есептеді" : "тегке тимеді"] : ["тыңдап тұр"]} />
      <Node x={4.5} color={last ? (last.accepted ? (last.tampered ? BAD : OK) : OK) : C1} title="Банк" lines={last ? [last.accepted ? "қабылдады" : "қабылдамады", last.accepted && last.tampered ? "жалған төлем!" : "дұрыс шешім"] : ["күтуде"]} />
      {[-2.25, 2.25].map((x) => (
        <mesh key={x} position={[x, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color={C1} />
        </mesh>
      ))}
    </group>
  );
}

function Person({ x, z, color, name, lines }: { x: number; z: number; color: Color; name: string; lines: string[] }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 1, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.38, 20, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Label text={name} position={[0, 2.1, 0]} size={0.5} />
      {lines.map((l, i) => (
        <Label key={i} text={l} position={[0, -0.35 - i * 0.6, 0.8]} size={0.5} />
      ))}
    </group>
  );
}

const keyColor = (n: number) => new Color().setHSL(((n * 47) % 360) / 360, 0.7, 0.5);

export function DhView({ state }: { state: SecLabState }) {
  const d = state.dh;
  const x = d.last;
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  return (
    <group>
      <Person x={-5} z={0} color={C0} name="Әлия" lines={[`a = ${fmt(d.a)}`, x && !x.aborted ? `кілт ${fmt(x.alice)}` : ""].filter(Boolean)} />
      <Person x={5} z={0} color={C0} name="Бекзат" lines={[`b = ${fmt(d.b)}`, x && !x.aborted ? `кілт ${fmt(x.bob)}` : ""].filter(Boolean)} />
      {d.mitm && <Person x={0} z={0} color={BAD} name="Мәлік" lines={x?.mallory ? ["екі кілтті де біледі"] : x?.aborted ? ["ұсталды"] : ["ортада"]} />}
      {!d.mitm && <Person x={0} z={2.6} color={OFF} name="Ева" lines={d.eve ? [d.eve.found !== null ? `a = ${d.eve.found} тапты` : "таба алмады"] : ["тыңдап тұр"]} />}
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 9, 8]} />
        <meshStandardMaterial color={x?.aborted ? BAD : C1} />
      </mesh>
      {x && <Label text={`арнада: A = ${fmt(x.A)}, B = ${fmt(x.B)}`} position={[0, 3.4, 0]} size={0.4} />}
      {x && !x.aborted && (
        <>
          <mesh position={[-5, 2.7, 0]}>
            <octahedronGeometry args={[0.35]} />
            <meshStandardMaterial color={keyColor(x.alice)} emissive={keyColor(x.alice)} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[5, 2.7, 0]}>
            <octahedronGeometry args={[0.35]} />
            <meshStandardMaterial color={keyColor(x.bob)} emissive={keyColor(x.bob)} emissiveIntensity={0.4} />
          </mesh>
        </>
      )}
    </group>
  );
}
