"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Color, type Group, type Mesh } from "three";
import {
  ARENA,
  GRID,
  cellCenter,
  worldTransform,
  type Entity,
  type GameLabState,
  type Tile,
} from "@inside-tech/lab-game";
import { FitCamera } from "./FitCamera";
import { BroadView, FsmView, PathView, PoolView } from "./GameMiddleViews";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

export type GameFocus = "scene" | "camera" | "loop" | "physics" | "graphics" | "game" | "editor" | "path" | "fsm" | "broad" | "pool";

interface Props {
  state: GameLabState;
  focus: GameFocus;
  brush: Tile;
  onSelect?: (id: number) => void;
  onTile?: (i: number, j: number) => void;
  onDrop?: (x: number, z: number) => void;
}

const RED = new Color("#c23b3b");
const WALL = new Color("#56617c");
const FLOOR = new Color("#8e97b8");
const GOLD = new Color("#f2b632");

// ---------------- scene graph ----------------

function Shape({ e }: { e: Entity }) {
  const [x, y, z] = e.size;
  switch (e.shape) {
    case "box":
      return <boxGeometry args={[x, y, z]} />;
    case "sphere":
      return <sphereGeometry args={[x / 2, 24, 16]} />;
    case "cylinder":
      return <cylinderGeometry args={[x / 2, x / 2, y, 24]} />;
    case "cone":
      return <coneGeometry args={[x / 2, y, 24]} />;
  }
}

function SceneGraph({ state, onSelect, showLabels = true }: { state: GameLabState; onSelect?: (id: number) => void; showLabels?: boolean }) {
  const { entities, selected } = state.scene;
  return (
    <group>
      {entities.map((e) => {
        const w = worldTransform(entities, e.id);
        const sel = e.id === selected;
        // Cylinders are wheels: lie them on their side.
        const tilt: [number, number, number] = e.shape === "cylinder" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        return (
          <group key={e.id} position={w.pos} rotation={[0, (w.rotY * Math.PI) / 180, 0]} scale={w.scale}>
            <mesh
              rotation={tilt}
              onClick={(ev) => {
                if (!onSelect || e.id === 1) return;
                ev.stopPropagation();
                onSelect(e.id);
              }}
            >
              <Shape e={e} />
              <meshStandardMaterial color={e.color} emissive={sel ? C1 : new Color("#000")} emissiveIntensity={sel ? 0.5 : 0} />
            </mesh>
            {showLabels && sel && <Label text={`${e.name} · (${w.pos.map((v) => v.toFixed(1)).join(", ")})`} position={[0, e.size[1] / 2 + 0.5, 0]} size={0.3} />}
          </group>
        );
      })}
    </group>
  );
}

// ---------------- camera ----------------

/** Game camera driven by state: fixed in the editor-like spot, or following the car. */
function GameCamera({ state }: { state: GameLabState }) {
  const c = state.camera;
  const persp = useRef(null);
  const set = useThree((s) => s.set);
  void set;
  const car = worldTransform(state.scene.entities, 2);
  const r = (car.rotY * Math.PI) / 180;
  const follow: [number, number, number] = [car.pos[0] - Math.cos(r) * c.distance, car.pos[1] + c.height, car.pos[2] + Math.sin(r) * c.distance];
  const pos: [number, number, number] = c.follow ? follow : [0, c.height + 2, c.distance + 4];
  const look: [number, number, number] = c.follow ? [car.pos[0], car.pos[1], car.pos[2]] : [0, 0.5, 0];
  return c.projection === "perspective" ? (
    <PerspectiveCamera ref={persp} makeDefault position={pos} fov={c.fov} near={0.1} far={100} onUpdate={(cam) => cam.lookAt(...look)} />
  ) : (
    <OrthographicCamera makeDefault position={pos} zoom={1} left={-c.orthoSize * 1.6} right={c.orthoSize * 1.6} top={c.orthoSize} bottom={-c.orthoSize} near={0.1} far={100} onUpdate={(cam) => cam.lookAt(...look)} />
  );
}

/** A small camera gizmo showing where the game camera stands, in the editor view. */
function CameraGizmo({ state }: { state: GameLabState }) {
  const c = state.camera;
  const car = worldTransform(state.scene.entities, 2);
  const r = (car.rotY * Math.PI) / 180;
  const pos: [number, number, number] = c.follow ? [car.pos[0] - Math.cos(r) * c.distance, car.pos[1] + c.height, car.pos[2] + Math.sin(r) * c.distance] : [0, c.height + 2, c.distance + 4];
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={[0.5, 0.35, 0.35]} />
        <meshStandardMaterial color={C1} />
      </mesh>
      <Label text={`Ойын камерасы · ${c.projection === "perspective" ? `FOV ${c.fov}°` : "ortho"}`} position={[0, 0.5, 0]} size={0.28} />
    </group>
  );
}

// ---------------- loop ----------------

function LoopLanes({ state }: { state: GameLabState }) {
  const l = state.loop;
  const lane = (i: number) => (i - 1) * 1.6;
  const X0 = -4.5;
  return (
    <group>
      {l.fps.map((fps, i) => (
        <group key={fps} position={[0, 0, lane(i)]}>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[10, 0.1, 1]} />
            <meshStandardMaterial color={FLOOR} />
          </mesh>
          <mesh position={[X0 + l.positions[i]! * 1.2, 0.3, 0]}>
            <boxGeometry args={[0.8, 0.5, 0.6]} />
            <meshStandardMaterial color={[C0, C1, RED][i]} />
          </mesh>
          <Label text={`${fps} FPS · ${l.frames[i]} кадр · ${l.positions[i]!.toFixed(2)} м`} position={[X0 - 0.2, 0.9, 0]} size={0.3} />
        </group>
      ))}
      <Label text={`${l.useDeltaTime ? "dt қосулы" : "dt жоқ"} · ${l.t.toFixed(2)} / ${l.duration} с`} position={[0, 2.2, 0]} size={0.38} />
    </group>
  );
}

// ---------------- physics ----------------

function PhysicsView({ state, onDrop }: { state: GameLabState; onDrop?: (x: number, z: number) => void }) {
  const p = state.physics;
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!onDrop) return;
    e.stopPropagation();
    onDrop(Math.round(e.point.x * 10) / 10, Math.round(e.point.z * 10) / 10);
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={click}>
        <planeGeometry args={[ARENA * 2, ARENA * 2]} />
        <meshStandardMaterial color={FLOOR} />
      </mesh>
      <gridHelper args={[ARENA * 2, 12, "#4a5794", "#2c3663"]} position={[0, 0.01, 0]} />
      {p.walls.map((w) => (
        <mesh key={w.id} position={[(w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2]}>
          <boxGeometry args={[w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]]} />
          <meshStandardMaterial color={WALL} transparent opacity={0.85} />
        </mesh>
      ))}
      {p.balls.map((b) => (
        <mesh key={b.id} position={b.pos}>
          <sphereGeometry args={[b.r, 24, 16]} />
          <meshStandardMaterial color={b.color} roughness={0.4} />
        </mesh>
      ))}
      <Label text={`g = ${p.params.gravity.toFixed(1)} · e = ${p.params.restitution.toFixed(2)} · substeps ${p.params.substeps}`} position={[0, 4.2, 0]} size={0.36} />
    </group>
  );
}

// ---------------- graphics ----------------

function GraphicsView({ state }: { state: GameLabState }) {
  const g = state.graphics;
  const knot = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (knot.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) knot.current.rotation.y += dt * 0.4;
  });
  const mat = (
    <meshStandardMaterial color={g.color} roughness={g.roughness} metalness={g.metalness} emissive={g.color} emissiveIntensity={g.emissive} flatShading={g.flatShading} key={String(g.flatShading)} />
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color={FLOOR} />
      </mesh>
      <mesh ref={knot} position={[0, 0.6, 0]}>
        <torusKnotGeometry args={[0.9, 0.3, g.flatShading ? 48 : 160, g.flatShading ? 8 : 24]} />
        {mat}
      </mesh>
      <mesh position={[-3, 0, 0]}>
        <sphereGeometry args={[0.9, g.flatShading ? 10 : 48, g.flatShading ? 8 : 32]} />
        {mat}
      </mesh>
      <mesh position={[3, 0, 0]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        {mat}
      </mesh>
      {g.point > 0 && (
        <mesh position={[0, 2.6, 2]}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshBasicMaterial color="#fff6d5" />
        </mesh>
      )}
    </group>
  );
}

function GraphicsLights({ state }: { state: GameLabState }) {
  const g = state.graphics;
  return (
    <>
      <ambientLight intensity={g.ambient} />
      {g.directional > 0 && <directionalLight position={[5, 6, 4]} intensity={g.directional} />}
      {g.point > 0 && <pointLight position={[0, 2.6, 2]} intensity={g.point} distance={12} decay={2} color="#fff1c9" />}
    </>
  );
}

// ---------------- arena game ----------------

function Coin({ x, z }: { x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 2.5;
  });
  return (
    <group ref={ref} position={[x, 0.45, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.06, 24]} />
        <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} emissive={GOLD} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

const STATE_COLOR = { patrol: new Color("#e07a7a"), chase: RED, return: new Color("#a46bd0") };

function Arena({ state, editor, onTile }: { state: GameLabState; editor: boolean; onTile?: (i: number, j: number) => void }) {
  const g = state.game;
  const tiles = useMemo(() => g.level.flatMap((row, j) => [...row].map((ch, i) => ({ i, j, ch }))), [g.level]);
  return (
    <group>
      {tiles.map(({ i, j, ch }) => {
        const [x, z] = cellCenter(i, j);
        const wall = ch === "#";
        return (
          <mesh
            key={`${i}-${j}`}
            position={[x, wall ? 0.4 : -0.05, z]}
            onClick={(e) => {
              if (!editor || !onTile) return;
              e.stopPropagation();
              onTile(i, j);
            }}
          >
            <boxGeometry args={[0.98, wall ? 0.8 : 0.1, 0.98]} />
            <meshStandardMaterial color={wall ? WALL : FLOOR} />
          </mesh>
        );
      })}
      {editor
        ? tiles
            .filter((t) => t.ch === "c" || t.ch === "e" || t.ch === "p")
            .map(({ i, j, ch }) => {
              const [x, z] = cellCenter(i, j);
              return (
                <mesh key={`m-${i}-${j}`} position={[x, 0.35, z]}>
                  {ch === "c" ? <cylinderGeometry args={[0.25, 0.25, 0.08, 20]} /> : <sphereGeometry args={[0.3, 20, 14]} />}
                  <meshStandardMaterial color={ch === "c" ? GOLD : ch === "e" ? RED : C0} />
                </mesh>
              );
            })
        : (
          <>
            {g.coins.filter((c) => !c.taken).map((c, k) => <Coin key={k} x={c.x} z={c.z} />)}
            {g.enemies.map((e) => (
              <group key={e.id} position={[e.x, 0.35, e.z]}>
                <mesh>
                  <sphereGeometry args={[0.3, 20, 14]} />
                  <meshStandardMaterial color={STATE_COLOR[e.state]} />
                </mesh>
                <Label text={e.state} position={[0, 0.6, 0]} size={0.26} />
                {e.state === "patrol" && (
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
                    <ringGeometry args={[state.game.ai.chaseRadius - 0.03, state.game.ai.chaseRadius, 48]} />
                    <meshBasicMaterial color={RED} transparent opacity={0.35} />
                  </mesh>
                )}
              </group>
            ))}
            <mesh position={[g.player.x, 0.35, g.player.z]}>
              <sphereGeometry args={[0.3, 24, 16]} />
              <meshStandardMaterial color={C0} emissive={C0} emissiveIntensity={0.2} />
            </mesh>
          </>
        )}
      {!editor && g.status !== "playing" && (
        <Label text={g.status === "won" ? "Жеңіс!" : g.status === "lost" ? `Жеңіліс: ${g.lastEvent}` : "«Ойынды бастау» бас"} position={[0, 2, 0]} size={0.5} />
      )}
    </group>
  );
}

// ---------------- frame & canvas ----------------

const FRAME: Record<GameFocus, { width: number; height: number; target: [number, number, number]; dir: [number, number, number] }> = {
  scene: { width: 10, height: 6, target: [0, 0.6, 0], dir: [0.6, 0.55, 1] },
  camera: { width: 11, height: 7, target: [0, 1, 0], dir: [0.8, 0.7, 1] },
  loop: { width: 12, height: 5, target: [0, 0.5, 0], dir: [0, 0.9, 1] },
  physics: { width: 12.5, height: 6, target: [0, 1.4, 0], dir: [0.2, 0.5, 1] },
  graphics: { width: 9, height: 4, target: [0, 0.3, 0], dir: [0, 0.25, 1] },
  game: { width: GRID + 0.5, height: GRID * 0.75, target: [0, 0, 0.6], dir: [0, 1.6, 1] },
  editor: { width: GRID + 0.5, height: GRID + 0.5, target: [0, 0, 0], dir: [0, 1, 0.08] },
  path: { width: 14, height: 9, target: [0, 0, 0.2], dir: [0, 1.6, 1] },
  fsm: { width: 15, height: 6, target: [0, 1.4, 0], dir: [0, 0.5, 1] },
  broad: { width: 11, height: 11, target: [0, 0, 0], dir: [0, 1.6, 1] },
  pool: { width: 18, height: 6, target: [0, 1.8, 0], dir: [0, 0.4, 1] },
};

export default function GameScene(props: Props) {
  const { state, focus } = props;
  const fr = FRAME[focus];
  const gameView = focus === "camera" && state.camera.view === "game";
  return (
    <Canvas key={`${focus}-${gameView ? "game" : "edit"}-${state.camera.projection}`} camera={{ position: [0, 6, 10], fov: 45, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: ойын қозғалтқышы">
      {focus === "graphics" ? (
        <GraphicsLights state={state} />
      ) : (
        <>
          <ambientLight intensity={0.75} />
          <directionalLight position={[4, 8, 5]} intensity={1.2} />
        </>
      )}
      {(focus === "scene" || focus === "camera") && <SceneGraph state={state} onSelect={props.onSelect} showLabels={!gameView} />}
      {focus === "camera" && !gameView && <CameraGizmo state={state} />}
      {focus === "loop" && <LoopLanes state={state} />}
      {focus === "physics" && <PhysicsView state={state} onDrop={props.onDrop} />}
      {focus === "graphics" && <GraphicsView state={state} />}
      {(focus === "game" || focus === "editor") && <Arena state={state} editor={focus === "editor"} onTile={props.onTile} />}
      {focus === "path" && <PathView state={state} />}
      {focus === "fsm" && <FsmView state={state} />}
      {focus === "broad" && <BroadView state={state} />}
      {focus === "pool" && <PoolView state={state} />}
      {gameView ? (
        <GameCamera state={state} />
      ) : (
        <>
          <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} enableRotate={focus !== "editor"} />
          <FitCamera width={fr.width} height={fr.height} target={fr.target} dir={fr.dir} />
        </>
      )}
    </Canvas>
  );
}
