"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, Group, MeshStandardMaterial, QuadraticBezierCurve3, SRGBColorSpace, TubeGeometry, Vector3 } from "three";
import { Label } from "../scene/Label";
import { StageLook } from "../scene/StageLook";
import { Emblem, FILM } from "./Emblems";
import { Dust, FilmFx, usePointerSway } from "./Fx";
import { QUALITY, type Quality } from "@/lib/quality";

export interface ChipBlock {
  id: string;
  title: string;
  inside: string;
  href: string;
}

export type HeroMode = "cinematic" | "explore";

/** Where block i sits on the die: two rows of five. */
export const blockPos = (i: number): [number, number, number] => [-2.6 + (i % 5) * 1.3, 0.32, i < 5 ? -1.05 : 1.05];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** How far the layers have come apart for a scroll progress (0 assembled, 1 fully exploded). */
export const explodeAt = (p: number) => smooth(clamp01((p - 0.22) / 0.5));

const GOLD = "#d9b35a";

/** Laser-etched marking on the cap, drawn once into a texture. */
function useSilkscreen() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 712;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(20, 26, 44, 0.78)";
    g.font = '600 112px "Unbounded", "IBM Plex Sans", sans-serif';
    g.fillText("INSIDE TECH", 90, 300);
    g.font = '500 44px "IBM Plex Mono", ui-monospace, monospace';
    g.fillText("IT-01   10-LAB SOC   KZ 2611", 96, 400);
    g.fillText("90 LESSONS   REV B", 96, 462);
    g.beginPath();
    g.arc(118, 600, 26, 0, Math.PI * 2);
    g.fill();
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

function BondWires() {
  const wires = useMemo(() => {
    const out: TubeGeometry[] = [];
    const arc = (a: Vector3, b: Vector3) => {
      const mid = a.clone().lerp(b, 0.5);
      mid.y += 0.32;
      return new TubeGeometry(new QuadraticBezierCurve3(a, mid, b), 10, 0.012, 5, false);
    };
    for (let z = -1.85; z <= 1.86; z += 0.37) for (const sx of [-1, 1]) out.push(arc(new Vector3(sx * 3.3, 0.27, z), new Vector3(sx * 3.68, 0.19, z)));
    for (let x = -3.0; x <= 3.01; x += 0.5) for (const sz of [-1, 1]) out.push(arc(new Vector3(x, 0.27, sz * 2.1), new Vector3(x, 0.19, sz * 2.56)));
    return out;
  }, []);
  return (
    <group>
      {wires.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** Package body, pins and the gold pads around the die cavity. */
function Substrate() {
  return (
    <group>
      <RoundedBox args={[7.6, 0.36, 5.4]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#141a2b" metalness={0.15} roughness={0.7} />
      </RoundedBox>
      {/* layered substrate edge: a thin green-gold laminate line like a real package */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[7.64, 0.04, 5.44]} />
        <meshStandardMaterial color="#3b4a3a" metalness={0.3} roughness={0.6} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) =>
        [-1, 1].map((s) => (
          <RoundedBox key={`${i}${s}`} args={[0.16, 0.08, 0.5]} radius={0.02} smoothness={2} position={[-3.4 + i * 0.523, -0.12, s * 2.85]}>
            <meshStandardMaterial color={FILM.pin} metalness={0.9} roughness={0.25} />
          </RoundedBox>
        )),
      )}
      {Array.from({ length: 11 }, (_, i) =>
        [-1, 1].map((s) => (
          <mesh key={`p${i}${s}`} position={[s * 3.68, 0.185, -1.85 + i * 0.37]}>
            <boxGeometry args={[0.12, 0.01, 0.08]} />
            <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

function DieSurface() {
  return (
    <group>
      <RoundedBox args={[6.8, 0.08, 4.4]} radius={0.02} smoothness={2} position={[0, 0.22, 0]}>
        <meshStandardMaterial color={FILM.die} metalness={0.6} roughness={0.3} />
      </RoundedBox>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={`gx${i}`} position={[-3 + i * 0.4, 0.262, 0]}>
          <boxGeometry args={[0.012, 0.004, 4.1]} />
          <meshStandardMaterial color="#33466f" emissive="#22335e" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={`gz${i}`} position={[0, 0.262, -2 + i * 0.4]}>
          <boxGeometry args={[6.4, 0.004, 0.012]} />
          <meshStandardMaterial color="#33466f" emissive="#22335e" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The copper interconnect layer: a bus with energy pulses and a stub to every block. */
function Interconnect({ count, still }: { count: number; still: boolean }) {
  const pulses = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (still || !pulses.current) return;
    pulses.current.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.35 + i / pulses.current!.children.length) % 1;
      c.position.x = -3 + t * 6;
    });
  });
  return (
    <group position={[0, 0.27, 0]}>
      <mesh>
        <boxGeometry args={[6.2, 0.02, 0.07]} />
        <meshStandardMaterial color={FILM.copper} metalness={0.7} roughness={0.3} emissive={FILM.copper} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const [x, , z] = blockPos(i);
        return (
          <mesh key={i} position={[x, 0, z / 2]}>
            <boxGeometry args={[0.05, 0.02, Math.abs(z) - 0.75]} />
            <meshStandardMaterial color={FILM.copper} metalness={0.7} roughness={0.3} emissive={FILM.copper} emissiveIntensity={1.1} toneMapped={false} />
          </mesh>
        );
      })}
      <group ref={pulses}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-3 + i * 1.2, 0.04, 0]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={FILM.copper} emissive={FILM.copper} emissiveIntensity={5} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Blocks({
  blocks,
  selected,
  explore,
  onSelect,
  onOpen,
  still,
}: {
  blocks: ChipBlock[];
  selected: number | null;
  explore: boolean;
  onSelect(i: number | null): void;
  onOpen(href: string): void;
  still: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <group>
      {blocks.map((b, i) => {
        const lit = hover === i || selected === i;
        return (
          <group
            key={b.id}
            position={blockPos(i)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover((h) => (h === i ? null : h));
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <RoundedBox args={[1.12, 0.1, 1.5]} radius={0.03} smoothness={2} position={[0, lit ? 0.1 : 0, 0]}>
              <meshStandardMaterial
                color={lit ? "#24345e" : FILM.dieEdge}
                metalness={0.45}
                roughness={0.35}
                emissive={lit ? FILM.glow : FILM.night}
                emissiveIntensity={lit ? 0.55 : 0}
              />
            </RoundedBox>
            {lit && (
              <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.78, 0.82, 4, 1]} />
                <meshStandardMaterial color={FILM.glow} emissive={FILM.glow} emissiveIntensity={3} toneMapped={false} />
              </mesh>
            )}
            <group position={[0, lit ? 0.16 : 0.06, 0]}>
              <Emblem labId={b.id} scale={0.5} spin={lit && !still} />
            </group>
            {explore && hover === i && <Label text={b.title} position={[0, 1.1, 0.2]} size={0.2} />}
          </group>
        );
      })}
    </group>
  );
}

interface RigProps {
  progress: MutableRefObject<number>;
  mode: HeroMode;
  selected: number | null;
  still: boolean;
}

/** Camera: hero three-quarter, exploded side view, explore overview, block close-up. */
function Rig({ progress, mode, selected, still }: RigProps) {
  const { camera, size } = useThree();
  const look = useRef(new Vector3());
  const sway = usePointerSway(still);
  useFrame((_, dt) => {
    const portrait = size.width < size.height;
    let pos: Vector3;
    let at: Vector3;
    if (mode === "explore") {
      if (selected !== null) {
        const b = new Vector3(...blockPos(selected));
        pos = b.clone().add(new Vector3(1.4, 3.1, 3.9));
        at = b.clone().add(new Vector3(0, 0.5, 0));
      } else {
        pos = new Vector3(0, 9.6, 6.4);
        at = new Vector3(0, 0, 0.4);
      }
      if (portrait) pos.multiplyScalar(1.6);
    } else {
      const e = explodeAt(progress.current);
      const hero = { pos: new Vector3(6.6, 5.6, 10.8), at: new Vector3(0.3, 0.3, 0) };
      const side = { pos: new Vector3(10.6, 5.2, 11.6), at: new Vector3(0.6, 1.9, 0) };
      pos = hero.pos.clone().lerp(side.pos, e);
      at = hero.at.clone().lerp(side.at, e);
      if (portrait) {
        pos.multiplyScalar(Math.min(2.2, Math.max(1.3, (0.95 * size.height) / size.width)));
        at.y -= 1.2;
      } else {
        // The headline sits on the left: keep the chip in the right 55% of the frame.
        const shift = 2.6 - e * 0.8;
        pos.x -= shift;
        at.x -= shift;
      }
    }
    pos.x += sway.current.x * 0.7;
    pos.y += sway.current.y * 0.45;
    const k = still ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(pos, k);
    look.current.lerp(at, k);
    camera.lookAt(look.current);
  });
  return null;
}

/** Moves the layers apart with the scroll (cinematic) or opens the cap (explore). */
function Layers({ progress, mode, blocks, selected, onSelect, onOpen, still }: RigProps & { blocks: ChipBlock[]; onSelect(i: number | null): void; onOpen(href: string): void }) {
  const lid = useRef<Group>(null);
  const die = useRef<Group>(null);
  const bus = useRef<Group>(null);
  const wires = useRef<Group>(null);
  const notes = useRef<Group>(null);
  const lidMat = useRef<MeshStandardMaterial>(null);
  const shown = useRef(0);
  const silk = useSilkscreen();
  useFrame((_, dt) => {
    const explore = mode === "explore";
    const target = explore ? 0 : explodeAt(progress.current);
    shown.current += (target - shown.current) * (still ? 1 : 1 - Math.exp(-dt * 6));
    const e = shown.current;
    if (die.current) die.current.position.y = e * 1.35;
    if (bus.current) bus.current.position.y = e * 2.7;
    if (wires.current) wires.current.visible = e < 0.03;
    if (notes.current) notes.current.visible = !explore && e > 0.7;
    if (lid.current && lidMat.current) {
      const lift = explore ? 9 : e * 3.3;
      lid.current.position.y += (0.85 + lift - lid.current.position.y) * (still ? 1 : 1 - Math.exp(-dt * 6));
      lid.current.rotation.x = -e * 0.12;
      lid.current.visible = lid.current.position.y < 7;
      lidMat.current.opacity = explore ? 0.2 : 1;
    }
  });
  return (
    <group>
      <Substrate />
      <group ref={wires}>
        <BondWires />
      </group>
      <group ref={die}>
        <DieSurface />
        <Blocks blocks={blocks} selected={selected} explore={mode === "explore"} onSelect={onSelect} onOpen={onOpen} still={still} />
      </group>
      <group ref={bus}>
        <Interconnect count={blocks.length} still={still} />
      </group>
      <group ref={lid} position={[0, 0.85, 0]}>
        <RoundedBox args={[7.2, 1.1, 5]} radius={0.12} smoothness={4}>
          <meshStandardMaterial ref={lidMat} color="#9ca5bb" metalness={0.9} roughness={0.34} transparent />
        </RoundedBox>
        <mesh position={[0, 0.556, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6.4, 4.45]} />
          <meshStandardMaterial map={silk} transparent metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
      <group ref={notes}>
        <Label text="Қақпақ: жылу таратқыш" position={[2.2, 5.1, 2.9]} size={0.26} />
        <Label text="Мыс байланыс қабаты" position={[2.2, 3.15, 2.9]} size={0.26} />
        <Label text="Кристалл: 10 зертхана" position={[2.2, 1.85, 2.9]} size={0.26} />
        <Label text="Негіз және түйреуіштер" position={[2.2, 0.35, 3.2]} size={0.26} />
      </group>
    </group>
  );
}

function Ready({ onReady }: { onReady(): void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function HeroChip({
  progress,
  blocks,
  mode,
  selected,
  onSelect,
  onOpen,
  onReady,
  still,
  quality,
}: {
  progress: MutableRefObject<number>;
  blocks: ChipBlock[];
  mode: HeroMode;
  selected: number | null;
  onSelect(i: number | null): void;
  onOpen(href: string): void;
  onReady(): void;
  still: boolean;
  quality: Quality;
}) {
  const q = QUALITY[quality];
  // Silkscreen text needs the web fonts: render once they are in.
  const [fonts, setFonts] = useState(false);
  useEffect(() => {
    void document.fonts?.ready.then(() => setFonts(true));
    if (!document.fonts) setFonts(true);
  }, []);
  return (
    <Canvas camera={{ position: [3, 4.4, 8.4], fov: 38, near: 0.1, far: 100 }} dpr={q.dpr} gl={{ antialias: true, alpha: true }} aria-hidden onPointerMissed={() => mode === "explore" && onSelect(null)}>
      <ambientLight intensity={0.3} />
      {/* key, fill and rim */}
      <directionalLight position={[6, 9, 6]} intensity={1.6} />
      <directionalLight position={[-7, 4, 2]} intensity={0.5} color="#7696ff" />
      <directionalLight position={[0, 3, -9]} intensity={1.1} color="#dda36e" />
      {fonts && <Layers progress={progress} mode={mode} blocks={blocks} selected={selected} onSelect={onSelect} onOpen={onOpen} still={still} />}
      <StageLook shadows={false} />
      <Dust still={still} count={q.dust} />
      <Rig progress={progress} mode={mode} selected={selected} still={still} />
      <FilmFx bloom={q.bloom} />
      <Ready onReady={onReady} />
    </Canvas>
  );
}

