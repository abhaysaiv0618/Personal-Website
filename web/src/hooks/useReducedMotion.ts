"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the OS "reduce motion" accessibility setting.
 *
 * Extracted from the inline listener in GraphNav.tsx so the 3D scene honours
 * the same preference the old CSS orbit did. Vestibular disorders make large
 * sweeping camera motion genuinely unpleasant, and a solar system is nothing
 * but large sweeping motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
