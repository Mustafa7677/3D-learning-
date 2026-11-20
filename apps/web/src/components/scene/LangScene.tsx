"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Object3D } from "three";
import { EOS, attention, languageModels, nearest, nextTokens, sentenceWords, type LangLabState } from "@inside-tech/lab-ai";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

export type LangFocus = "tokens" | "embedding" | "attention" | "llm";

interface Props {
  state: LangLabState;
  focus: LangFocus;
  onWordPick?: (word: string) => void;
}

const SPREAD = 2.8;
const LIFT = 1.6;
const dummy = new Object3D();
const BASE = new Color("#9aa6bd");
const INK = new Color("#18203a");
const tmp = new Color();

const worldPos = (c: [number, number, number]): [number, number, number] => [c[0] * SPREAD, c[2] * SPREAD * 0.6 + LIFT, -c[1] * SPREAD];

/** Every corpus word as a point; position = its learned vector (first three components). */
function WordCloud({ state, onWordPick }: Props) {
  const { emb } = languageModels();
  const ref = useRef<InstancedMesh>(null);
  const sentence = useMemo(() => new Set(sentenceWords(state)), [state]);
  const near = useMemo(() => new Set(state.selectedWord ? nearest(emb, state.selectedWord, 6).map((n) => n.word) : []), [emb, state.selectedWord]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    emb.vocab.forEach((w, i) => {
      dummy.position.set(...worldPos(emb.coords[i]!));
      const big = w === state.selectedWord ? 2.2 : near.has(w) || sentence.has(w) ? 1.5 : 1;
      dummy.scale.setScalar(big);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(w === state.selectedWord ? C1 : near.has(w) ? C0 : sentence.has(w) ? INK : BASE);
      mesh.setColorAt(i, tmp);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [emb, state.selectedWord, near, sentence]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || !onWordPick) return;
    e.stopPropagation();
    onWordPick(emb.vocab[e.instanceId]!);
  };

  const labelled = [...new Set([state.selectedWord, ...near, ...sentence].filter((w): w is string => !!w && emb.index.has(w)))].slice(0, 14);

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, emb.vocab.length]}
        onClick={click}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      {labelled.map((w) => {
        const p = worldPos(emb.coords[emb.index.get(w)!]!);
        return <Label key={w} text={w} position={[p[0], p[1] + 0.22, p[2]]} size={0.24} />;
      })}
    </group>
  );
}

/** Lines from the selected token to every token it attends to; opacity = attention weight. */
function AttentionLines({ state }: { state: LangLabState }) {
  const { emb } = languageModels();
  const sel = state.selectedToken;
  const a = useMemo(() => attention(state), [state]);
  if (sel === null) return null;
  const row = a.weights[sel];
  const from = a.tokens[sel];
  if (!row || !from || !emb.index.has(from)) return null;
  const p0 = worldPos(emb.coords[emb.index.get(from)!]!);
  return (
    <group>
      {row.map((w, j) => {
        const t = a.tokens[j]!;
        if (w < 0.01 || !emb.index.has(t)) return null;
        const p1 = worldPos(emb.coords[emb.index.get(t)!]!);
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array([...p0, ...p1]), 3));
        return (
          <lineSegments key={j} geometry={g}>
            <lineBasicMaterial color={C1} transparent opacity={Math.min(1, 0.25 + w * 1.5)} linewidth={2} />
          </lineSegments>
        );
      })}
    </group>
  );
}

/** Next-token probabilities as a row of bars. */
function ProbabilityBars({ state }: { state: LangLabState }) {
  const top = nextTokens(state).shaped.slice(0, 10);
  const gap = 0.62;
  const x0 = (-(top.length - 1) * gap) / 2;
  return (
    <group position={[0, 0, 0]}>
      {top.map((t, i) => {
        const h = Math.max(0.02, t.p * 2.6);
        const x = x0 + i * gap;
        return (
          <group key={t.token} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.45, h, 0.45]} />
              <meshStandardMaterial color={i === 0 ? C1 : C0} roughness={0.5} />
            </mesh>
            <Label text={t.token === EOS ? "[соңы]" : t.token} position={[0, h + 0.25, 0]} size={0.2} />
            <Label text={`${Math.round(t.p * 100)}%`} position={[0, -0.2, 0.35]} size={0.17} />
          </group>
        );
      })}
    </group>
  );
}



export default function LangScene(props: Props) {
  const llm = props.focus === "llm";
  return (
    <Canvas
      key={llm ? "llm" : "space"}
      camera={{ position: [0, 4, 9], fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label={llm ? "3D көрініс: келесі токен ықтималдықтары" : "3D көрініс: сөз векторларының кеңістігі"}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 8, 5]} intensity={1.3} />
      <gridHelper args={[10, 10, "#9aa6bd", "#c3cad8"]} />
      {llm ? (
        <ProbabilityBars state={props.state} />
      ) : (
        <>
          <WordCloud {...props} />
          {props.focus === "attention" && <AttentionLines state={props.state} />}
        </>
      )}
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={25} />
      {llm ? <FitCamera width={7.4} height={4} target={[0, 1.2, 0]} dir={[0, 0.25, 1]} /> : <FitCamera width={7.2} height={5} target={[0, LIFT, 0]} dir={[0, 0.45, 1]} />}
    </Canvas>
  );
}
