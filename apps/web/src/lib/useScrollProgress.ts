"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * How far the page has scrolled through a tall element: 0 when its top meets the
 * top of the viewport, 1 when its bottom meets the bottom. The value lives in a
 * ref (read it every frame); `chapter` is a coarse, re-rendering index.
 */
export function useScrollProgress(el: RefObject<HTMLElement | null>, chapters = 1) {
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const node = el.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      progress.current = p;
      setChapter(Math.min(chapters - 1, Math.floor(p * chapters + 1e-6)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [el, chapters]);
  return { progress, chapter };
}
