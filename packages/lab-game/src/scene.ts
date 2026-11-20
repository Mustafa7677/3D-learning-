/**
 * Scene graph: every object has a local transform relative to its parent.
 * World transforms are the product of the chain up to the root — move a
 * parent and all of its children move with it.
 */
export type V3 = [number, number, number];

export interface Entity {
  id: number;
  name: string;
  parent: number | null;
  pos: V3;
  /** Rotation about the vertical axis, degrees. */
  rotY: number;
  scale: number;
  shape: "box" | "sphere" | "cylinder" | "cone";
  color: string;
  size: V3;
}

export interface WorldTransform {
  pos: V3;
  rotY: number;
  scale: number;
}

export function worldTransform(entities: Entity[], id: number, guard = 0): WorldTransform {
  const e = entities.find((x) => x.id === id);
  if (!e) return { pos: [0, 0, 0], rotY: 0, scale: 1 };
  if (e.parent === null || guard > 32) return { pos: [...e.pos] as V3, rotY: e.rotY, scale: e.scale };
  const p = worldTransform(entities, e.parent, guard + 1);
  const r = (p.rotY * Math.PI) / 180;
  const [x, y, z] = e.pos;
  const sx = x * p.scale;
  const sy = y * p.scale;
  const sz = z * p.scale;
  return {
    pos: [p.pos[0] + sx * Math.cos(r) + sz * Math.sin(r), p.pos[1] + sy, p.pos[2] - sx * Math.sin(r) + sz * Math.cos(r)],
    rotY: p.rotY + e.rotY,
    scale: p.scale * e.scale,
  };
}

/** True if `ancestor` is `id` or one of its parents (used to forbid cycles). */
export function isAncestor(entities: Entity[], ancestor: number, id: number): boolean {
  let cur: number | null = id;
  for (let i = 0; i < 64 && cur !== null; i++) {
    if (cur === ancestor) return true;
    cur = entities.find((e) => e.id === cur)?.parent ?? null;
  }
  return false;
}

/** Reparent keeping the world position (what "attach" does in game engines). */
export function reparent(entities: Entity[], id: number, parent: number | null): Entity[] {
  if (parent !== null && isAncestor(entities, id, parent)) return entities;
  const world = worldTransform(entities, id);
  let local: V3 = world.pos;
  let rotY = world.rotY;
  let scale = world.scale;
  if (parent !== null) {
    const p = worldTransform(entities, parent);
    const r = (-p.rotY * Math.PI) / 180;
    const dx = (world.pos[0] - p.pos[0]) / p.scale;
    const dy = (world.pos[1] - p.pos[1]) / p.scale;
    const dz = (world.pos[2] - p.pos[2]) / p.scale;
    local = [dx * Math.cos(r) + dz * Math.sin(r), dy, -dx * Math.sin(r) + dz * Math.cos(r)];
    rotY = world.rotY - p.rotY;
    scale = world.scale / p.scale;
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return entities.map((e) => (e.id === id ? { ...e, parent, pos: local.map(round) as V3, rotY: round(rotY), scale: round(scale) } : e));
}

export function starterScene(): Entity[] {
  return [
    { id: 1, name: "Жер", parent: null, pos: [0, -0.05, 0], rotY: 0, scale: 1, shape: "box", color: "#c9d0de", size: [12, 0.1, 12] },
    { id: 2, name: "Машина", parent: null, pos: [-2, 0.5, 0], rotY: 0, scale: 1, shape: "box", color: "#2f5bea", size: [2, 0.6, 1] },
    { id: 3, name: "Кабина", parent: 2, pos: [-0.2, 0.5, 0], rotY: 0, scale: 1, shape: "box", color: "#6d8cff", size: [1, 0.5, 0.9] },
    { id: 4, name: "Алдыңғы дөңгелек", parent: 2, pos: [0.7, -0.3, 0.55], rotY: 0, scale: 1, shape: "cylinder", color: "#18203a", size: [0.6, 0.25, 0.6] },
    { id: 5, name: "Артқы дөңгелек", parent: 2, pos: [-0.7, -0.3, 0.55], rotY: 0, scale: 1, shape: "cylinder", color: "#18203a", size: [0.6, 0.25, 0.6] },
    { id: 6, name: "Шырша", parent: null, pos: [3, 0.9, -2], rotY: 0, scale: 1, shape: "cone", color: "#17895c", size: [1.2, 1.8, 1.2] },
    { id: 7, name: "Шам", parent: null, pos: [2, 0.25, 2], rotY: 0, scale: 1, shape: "sphere", color: "#ee9a22", size: [0.5, 0.5, 0.5] },
  ];
}
