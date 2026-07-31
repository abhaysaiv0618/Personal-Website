"use client";

import { useEffect } from "react";
import { cutTiming } from "@/lib/cut";
import { getPlanet } from "@/lib/planets";
import { isBusy, useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The veil that hides the landing cut — and, less obviously, the thing that
 * *decides when the cut happens*.
 *
 * Putting that decision here rather than in the 3D scene is the whole trick.
 * The swap has exactly one safety condition — the screen must be solid before
 * the world underneath it changes — and this component is the screen. It knows
 * when it is opaque; nothing else does. So it fires `touchDown` and
 * `returnToOrbit` itself, at SWAP_MS, comfortably after its own transition has
 * finished. See lib/cut.ts for why the two timelines are ordered rather than
 * synchronised.
 *
 * A timer, not the `transitionend` event, because transitionend does not fire
 * if the tab is backgrounded mid-fade — which would strand the phase machine
 * in `descending` forever with no way out. A timer keeps running. The same
 * "fail forward rather than get stuck" reasoning is why Flight calls arrive()
 * when its destination planet is missing.
 *
 * The colour is the destination planet's own accent rather than black: fading
 * through a planet's colour reads as descending into its atmosphere, where
 * black reads as a scene transition in a slideshow.
 */
export default function FadeOverlay() {
  const phase = useSystemStore((s) => s.phase);
  const focusedId = useSystemStore((s) => s.focusedId);
  const touchDown = useSystemStore((s) => s.touchDown);
  const returnToOrbit = useSystemStore((s) => s.returnToOrbit);
  const reduced = useReducedMotion();

  const timing = cutTiming(reduced);
  const closing = phase === "descending" || phase === "departing";
  const planet = focusedId ? getPlanet(focusedId) : undefined;

  useEffect(() => {
    if (phase !== "descending" && phase !== "departing") return;
    const swap = phase === "descending" ? touchDown : returnToOrbit;
    const timer = setTimeout(swap, timing.SWAP_MS);
    // Clearing on unmount matters: without it a fast reload mid-cut would fire
    // a transition into a store that has already reset.
    return () => clearTimeout(timer);
  }, [phase, timing.SWAP_MS, touchDown, returnToOrbit]);

  return (
    <div
      // Always mounted, never conditionally rendered. An element that mounts
      // already at opacity 1 has nothing to transition *from*, so the veil
      // would snap instead of fade and the cut would be plainly visible.
      className="absolute inset-0 z-30"
      style={{
        backgroundColor: planet?.accent ?? "#000000",
        opacity: closing ? 1 : 0,
        transitionProperty: "opacity",
        // Asymmetric on purpose: the close is racing the swap deadline, the
        // open is free to take its time revealing the new world.
        transitionDuration: `${closing ? timing.VEIL_IN_MS : timing.VEIL_OUT_MS}ms`,
        transitionTimingFunction: "ease-in-out",
        // Swallow input only while a scripted move is running. Left on during
        // the opening fade it would eat the visitor's first look around; left
        // off during the closing fade, a stray click would reach planets that
        // are still technically hit-testable behind it.
        pointerEvents: isBusy(phase) ? "auto" : "none",
      }}
      aria-hidden
    />
  );
}
