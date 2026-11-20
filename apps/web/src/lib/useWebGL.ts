"use client";

import { useEffect, useState } from "react";

/** undefined while checking, then true/false. */
export function useWebGL(): boolean | undefined {
  const [ok, setOk] = useState<boolean>();
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}
