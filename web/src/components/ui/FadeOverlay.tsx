"use client";

import { useEffect, useState } from "react";
import { cutTiming } from "@/lib/cut";
import { getPlanet } from "@/lib/planets";
import { SPACE_COLOR } from "@/lib/surface";
import { isBusy, useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The veil that hides a scene swap — and, less obviously, the thing that
 * *decides when the swap happens*.
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
 * in a backgrounded tab — which would strand the phase machine mid-cut forever
 * with no way out. A timer keeps running. Same "fail forward rather than get
 * stuck" reasoning as Flight calling arrive() when its destination is missing.
 *
 * The two directions do not look alike. Going down, the veil closes
 * immediately in the planet's own accent, which reads as dropping into an
 * atmosphere. Going up it waits — the rocket has to light and climb first —
 * and then closes *black*, because flashing the screen bright at the moment
 * you are leaving for space is precisely backwards. By then SurfaceScene has
 * already darkened the sky, so black closes over black and the veil barely
 * registers as one.
 */
export default function FadeOverlay() {
  const phase = useSystemStore((s) => s.phase);
  const focusedId = useSystemStore((s) => s.focusedId);
  const touchDown = useSystemStore((s) => s.touchDown);
  const returnToOrbit = useSystemStore((s) => s.returnToOrbit);
  const reduced = useReducedMotion();

  const closing = phase === "descending" || phase === "departing";
  const timing = cutTiming(phase === "departing" ? "up" : "down", reduced);

  /**
   * Held in state rather than derived from the current phase, because the veil
   * outlives the phase that opened it. `returnToOrbit` flips to `focused` while
   * the screen is still solid and only *then* fades out — so a colour computed
   * from the live phase would swap to the planet accent at full opacity and
   * flash the screen bright on the way out. Exactly the bug this whole change
   * set out to remove.
   */
  const [veilColor, setVeilColor] = useState(SPACE_COLOR);

  useEffect(() => {
    if (phase !== "descending" && phase !== "departing") return;

    setVeilColor(
      phase === "descending"
        ? getPlanet(focusedId ?? "")?.accent ?? SPACE_COLOR
        : SPACE_COLOR
    );

    const swap = phase === "descending" ? touchDown : returnToOrbit;
    const timer = setTimeout(swap, timing.SWAP_MS);
    // Clearing on unmount matters: without it a fast reload mid-cut would fire
    // a transition into a store that has already reset.
    return () => clearTimeout(timer);
  }, [phase, focusedId, timing.SWAP_MS, touchDown, returnToOrbit]);

  return (
    <div
      // Always mounted, never conditionally rendered. An element that mounts
      // already at opacity 1 has nothing to transition *from*, so the veil
      // would snap instead of fade and the cut would be plainly visible.
      className="absolute inset-0 z-30"
      style={{
        backgroundColor: veilColor,
        opacity: closing ? 1 : 0,
        transitionProperty: "opacity",
        // Asymmetric on purpose: the close is racing the swap deadline, the
        // open is free to take its time revealing the new world.
        transitionDuration: `${closing ? timing.VEIL_IN_MS : timing.VEIL_OUT_MS}ms`,
        // Only the close waits. Going up, this is what buys the launch its
        // screen time before anything starts hiding it.
        transitionDelay: `${closing ? timing.VEIL_DELAY_MS : 0}ms`,
        transitionTimingFunction: "ease-in-out",
        // Swallow input only while a scripted move is running. Left on during
        // the opening fade it would eat the visitor's first look around; left
        // off during the closing fade, a stray click would reach objects still
        // technically hit-testable behind it.
        pointerEvents: isBusy(phase) ? "auto" : "none",
      }}
      aria-hidden
    />
  );
}
