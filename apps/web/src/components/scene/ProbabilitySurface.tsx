"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { BufferAttribute, Color, DoubleSide, PlaneGeometry } from "three";
import { H, S, probColor } from "./palette";

interface Props {
  /** Row-major probabilities over [-1,1]², `res`×`res`, rows from y=-1 to y=1. */
  grid: Float32Array;
  res: number;
  opacity?: number;
}

const tmp = new Color();

/** The model's belief as terrain: height and colour are P(class = 1). */
export function ProbabilitySurface({ grid, res, opacity = 0.78 }: Props) {
  const geom = useMemo(() => {
    const g = new PlaneGeometry(2 * S, 2 * S, res - 1, res - 1);
    g.rotateX(-Math.PI / 2);
    g.setAttribute("color", new BufferAttribute(new Float32Array(res * res * 3), 3));
    return g;
  }, [res]);
  const ref = useRef(geom);
  ref.current = geom;

  useLayoutEffect(() => () => geom.dispose(), [geom]);

  useLayoutEffect(() => {
    const pos = geom.attributes.position as BufferAttribute;
    const col = geom.attributes.color as BufferAttribute;
    // PlaneGeometry vertices run row by row from -z (far) to +z (near) after rotation.
    // World z = -y*S, so far rows are y = +1: grid row index = res-1-row.
    for (let row = 0; row < res; row++) {
      for (let c = 0; c < res; c++) {
        const v = row * res + c;
        const p = grid[(res - 1 - row) * res + c] ?? 0.5;
        pos.setY(v, p * H);
        probColor(p, tmp);
        col.setXYZ(v, tmp.r, tmp.g, tmp.b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geom.computeVertexNormals();
  }, [grid, res, geom]);

  return (
    <mesh geometry={geom} renderOrder={1}>
      <meshStandardMaterial vertexColors transparent opacity={opacity} side={DoubleSide} roughness={0.8} depthWrite={false} />
    </mesh>
  );
}
