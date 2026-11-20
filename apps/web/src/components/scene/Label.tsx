"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

interface Props {
  text: string;
  position: [number, number, number];
  /** World-units height of the label. */
  size?: number;
}

const PX = 64;

/**
 * Text label drawn into a canvas texture on a sprite. Pure WebGL: no DOM
 * portals: so it can mount and unmount at simulation speed safely.
 */
export function Label({ text, position, size = 0.3 }: Props) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `500 ${PX * 0.62}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width + PX * 0.5);
    canvas.width = w;
    canvas.height = PX;
    ctx.font = font;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const r = PX * 0.18;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, PX, r);
    ctx.fill();
    ctx.fillStyle = "#18203a";
    ctx.textBaseline = "middle";
    ctx.fillText(text, PX * 0.25, PX * 0.54);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    return { texture: t, aspect: w / PX };
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
