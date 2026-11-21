"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { LINKS, ROUTERS, distanceVector, shortestPath, type NetLabState } from "@inside-tech/lab-net";
import { Label } from "./Label";

/**
 * Routing as a film set: every router is a tower on a gold-rimmed plinth,
 * every link a cable on the ground. The cheapest path glows cobalt and a
 * packet keeps running along it; a cut link lies dark red and flickers.
 */
const GOLD = new Color("#c9a24a");
const COBALT = new Color("#4f74ff");
const EMBER = new Color("#ff9a3c");
const RED = new Color("#e04a3b");
const METAL = new Color("#2a3147");
const DARK = new Color("#141826");
const up = new Vector3(0, 1, 0);
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const CABLE_Y = 0.12;

function Cable({ a, b, state }: { a: Vector3; b: Vector3; state: "path" | "cut" | "idle" }) {
  const mat = useRef<MeshStandardMaterial>(null);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    if (state === "cut") m.emissiveIntensity = reduced() ? 0.8 : 0.4 + 0.6 * Math.abs(Math.sin(clock.elapsedTime * 3));
  });
  const color = state === "path" ? COBALT : state === "cut" ? RED : GOLD;
  return (
    <mesh position={mid} quaternion={new Quaternion().setFromUnitVectors(up, dir.clone().normalize())}>
      <cylinderGeometry args={[state === "path" ? 0.08 : 0.04, state === "path" ? 0.08 : 0.04, dir.length(), 10]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={state === "path" ? 2.4 : state === "cut" ? 0.8 : 0.35} metalness={0.6} roughness={0.35} toneMapped={false} />
    </mesh>
  );
}

function Tower({ id, role, label }: { id: string; role: "end" | "path" | "idle"; label: string }) {
  const beacon = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = role === "idle" ? 0.5 : reduced() ? 2.5 : 1.6 + 1.2 * Math.sin(clock.elapsedTime * 4 + id.charCodeAt(0));
  });
  const light = role === "end" ? EMBER : role === "path" ? COBALT : GOLD;
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.62, 0.7, 0.14, 6]} />
        <meshStandardMaterial color={DARK} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.02, 8, 6]} />
        <meshStandardMaterial color={light} emissive={light} emissiveIntensity={role === "idle" ? 0.5 : 2.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.12, 0.26, 1.1, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
      </mesh>
      {[0.45, 0.75].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24 - y * 0.08, 0.012, 6, 20]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 1.33, 0]}>
        <sphereGeometry args={[0.1, 14, 10]} />
        <meshStandardMaterial ref={beacon} color="#ffffff" emissive={light} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <Label text={label} position={[0, 1.75, 0]} size={0.34} />
    </group>
  );
}

/** A packet running along the path again and again, with a short trail. */
function Runner({ points }: { points: Vector3[] }) {
  const head = useRef<Group>(null);
  const trail = useRef<Group>(null);
  const lengths = useMemo(() => {
    const out = [0];
    for (let i = 1; i < points.length; i++) out.push(out[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
    return out;
  }, [points]);
  const total = lengths.at(-1) ?? 0;
  const at = (d: number) => {
    const x = ((d % total) + total) % total;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i]! < x) i++;
    const k = (x - lengths[i - 1]!) / Math.max(1e-6, lengths[i]! - lengths[i - 1]!);
    return points[i - 1]!.clone().lerp(points[i]!, k);
  };
  useFrame(({ clock }) => {
    if (!head.current || total === 0) return;
    const d = reduced() ? total * 0.5 : clock.elapsedTime * 3.2;
    head.current.position.copy(at(d)).setY(CABLE_Y + 0.22);
    trail.current?.children.forEach((c, k) => {
      c.visible = !reduced();
      c.position.copy(at(d - (k + 1) * 0.16)).setY(CABLE_Y + 0.22);
    });
  });
  if (points.length < 2) return null;
  return (
    <>
      <group ref={head}>
        <mesh>
          <icosahedronGeometry args={[0.16, 2]} />
          <meshStandardMaterial color="#ffffff" emissive={COBALT} emissiveIntensity={4} toneMapped={false} />
        </mesh>
        <pointLight color={COBALT} intensity={5} distance={3.5} />
      </group>
      <group ref={trail}>
        {Array.from({ length: 10 }, (_, k) => (
          <mesh key={k}>
            <sphereGeometry args={[0.1 * (1 - k / 11), 10, 8]} />
            <meshStandardMaterial color={COBALT} emissive={COBALT} emissiveIntensity={2.4 * (1 - k / 10)} toneMapped={false} transparent opacity={1 - k / 10} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function NetRoutingStage({ state }: { state: NetLabState }) {
  const r = state.routing;
  const pos = useMemo(() => Object.fromEntries(ROUTERS.map((x) => [x.id, new Vector3(x.x, CABLE_Y, x.z)])), []);
  const path = r.algo === "ls" ? shortestPath(r.from, r.to, r.failed).path : [];
  const dv = r.algo === "dv" ? distanceVector(r.to, r.rounds, r.failed) : null;
  const onPath = (a: string, b: string) => path.some((p, i) => i > 0 && ((path[i - 1] === a && p === b) || (path[i - 1] === b && p === a)));
  const points = useMemo(() => path.map((id) => pos[id]!), [path.join(","), pos]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <fog attach="fog" args={["#0a0d1a", 14, 34]} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11, 64]} />
        <meshStandardMaterial color="#0e1222" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.2, 9.26, 96]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {LINKS.map((l) => {
        const failed = r.failed.includes(l.id);
        const mid = pos[l.a]!.clone().add(pos[l.b]!).multiplyScalar(0.5);
        return (
          <group key={l.id}>
            <Cable a={pos[l.a]!} b={pos[l.b]!} state={failed ? "cut" : onPath(l.a, l.b) ? "path" : "idle"} />
            <Label text={failed ? `${l.id} ✕` : `${l.cost}`} position={[mid.x, 0.55, mid.z]} size={0.3} />
          </group>
        );
      })}
      {ROUTERS.map((x) => {
        const d = dv?.[x.id];
        const role = x.id === r.from || x.id === r.to ? "end" : path.includes(x.id) ? "path" : "idle";
        return (
          <group key={x.id} position={[x.x, 0, x.z]}>
            <Tower id={x.id} role={role} label={dv ? `${x.id}: ${d === Infinity ? "∞" : d}` : x.id} />
          </group>
        );
      })}
      <Runner points={points} />
      <Label text={dv ? `Distance vector · ${r.rounds}-раунд · мақсат ${r.to}` : path.length ? `${path.join(" → ")}` : "Жол жоқ"} position={[0, 2.8, -3.6]} size={0.42} />
    </group>
  );
}
