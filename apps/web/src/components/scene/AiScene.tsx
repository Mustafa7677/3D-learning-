"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { activeNetwork, predictionGrid, selectedTrace, type AiLabState } from "@inside-tech/lab-ai";
import { DataPoints } from "./DataPoints";
import { ProbabilitySurface } from "./ProbabilitySurface";
import { NetworkDiagram } from "./NetworkDiagram";
import { S, fromWorld } from "./palette";

export type SceneFocus = "dataset" | "surface" | "neuron" | "network" | "charts" | "overview";

export interface AiSceneProps {
  state: AiLabState;
  focus: SceneFocus;
  onPointPick?: (id: number) => void;
  onFloorPick?: (x: number, y: number) => void;
  autoRotate?: boolean;
  /** Hide the surface entirely (pure data view). */
  showSurface?: boolean;
  showNetwork?: boolean;
  gridRes?: number;
}

/**
 * Each focus frames a region of the world: a target, a viewing direction and
 * the width/height that must stay visible. Distance is solved from the
 * viewport aspect, so portrait phones and wide desktops both fit.
 */
const FOCUS: Record<SceneFocus, { target: [number, number, number]; dir: [number, number, number]; width: number; height: number }> = {
  dataset: { target: [0, 0.4, 0], dir: [0, 7.5, 6.5], width: 6.8, height: 5.2 },
  surface: { target: [0, 0.6, 0], dir: [6.2, 5.6, 7.4], width: 7.6, height: 5 },
  charts: { target: [0, 0.6, 0], dir: [6.2, 5.6, 7.4], width: 7.6, height: 5 },
  neuron: { target: [3.1, 0.8, 0], dir: [0, 4.5, 10], width: 13, height: 4.5 },
  network: { target: [3.4, 0.8, 0], dir: [0, 4.5, 10], width: 14, height: 5 },
  overview: { target: [0, 0.5, 0], dir: [6.5, 5.5, 7.5], width: 7.2, height: 4.6 },
};

const FOV = 45;

function framing(focus: SceneFocus, aspect: number): { pos: Vector3; target: Vector3 } {
  const f = FOCUS[focus];
  const vHalf = ((FOV / 2) * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const dist = Math.max(f.width / 2 / Math.tan(hHalf), f.height / 2 / Math.tan(vHalf)) * 1.08;
  const target = new Vector3(...f.target);
  const pos = new Vector3(...f.dir).normalize().multiplyScalar(dist).add(target);
  return { pos, target };
}

function CameraRig({ focus }: { focus: SceneFocus }) {
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const goal = useRef<{ pos: Vector3; target: Vector3; t: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { pos, target } = framing(focus, size.width / Math.max(1, size.height));
    goal.current = { pos, target, t: reduce || first.current ? 1 : 0 };
    first.current = false;
  }, [focus, size.width, size.height]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    g.t = Math.min(1, g.t + dt * 1.6);
    const k = g.t >= 1 ? 1 : 1 - Math.pow(1 - g.t, 3);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (g.t >= 1) goal.current = null;
  });
  return null;
}

function Floor({ onPick }: { onPick?: (x: number, y: number) => void }) {
  const handle = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick) return;
    e.stopPropagation();
    const [x, y] = fromWorld(e.point.x, e.point.z);
    if (Math.abs(x) <= 1 && Math.abs(y) <= 1) onPick(x, y);
  };
  return (
    <group>
      <gridHelper args={[2 * S, 12, "#9aa6bd", "#c3cad8"]} position={[0, 0.001, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handle} receiveShadow>
        <planeGeometry args={[2 * S, 2 * S]} />
        <meshStandardMaterial color="#f5f7fa" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function SceneContents(props: AiSceneProps) {
  const { state, focus, gridRes = 36 } = props;
  const net = useMemo(() => activeNetwork(state), [state]);
  const grid = useMemo(() => predictionGrid(state, gridRes), [state, gridRes]);
  const trace = useMemo(() => selectedTrace(state), [state]);
  const showSurface = props.showSurface ?? focus !== "dataset";
  const showNetwork = props.showNetwork ?? (focus === "neuron" || focus === "network");

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 8, 5]} intensity={1.4} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <Floor onPick={props.onFloorPick} />
      <DataPoints points={state.points} selectedId={state.selectedPointId} onPick={props.onPointPick} />
      {showSurface && <ProbabilitySurface grid={grid} res={gridRes} opacity={focus === "surface" || focus === "charts" ? 0.8 : 0.45} />}
      {showNetwork && <NetworkDiagram network={net} trace={trace} annotate={state.model === "neuron"} />}
      <CameraRig focus={focus} />
      <OrbitControls
        makeDefault
        autoRotate={props.autoRotate}
        autoRotateSpeed={0.6}
        enableDamping
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

export default function AiScene(props: AiSceneProps) {
  return (
    <Canvas
      camera={{ position: framing(props.focus, 1.4).pos.toArray(), fov: FOV, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-label="3D көрініс: деректер нүктелері және модельдің ықтималдық беті"
      role="img"
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
