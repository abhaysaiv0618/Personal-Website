"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Planet } from "@/lib/planets";
import { propLayout } from "@/lib/props";
import { SURFACE_ORIGIN } from "@/lib/surface";
import { useSystemStore } from "@/lib/store";

/**
 * How far off-centre an object may sit and still be considered "looked at".
 *
 * This is the whole dismiss gesture. Turn toward the rocket, or up at the sky,
 * and nothing is inside the cone — the panel closes on its own. Without a
 * cutoff the nearest object always wins, so the panel could never be empty and
 * there would be no way to just *look at the place* without reading something.
 */
const GAZE_CONE_DEG = 22;

/**
 * How much better a challenger has to be before it takes over.
 *
 * A dead zone, and it is not a nicety. Standing with the view exactly between
 * two objects, whichever is marginally nearer wins — and that margin flips with
 * sub-pixel camera jitter, so the panel would swap content every frame. The
 * margin means the incumbent keeps the panel until you have clearly turned
 * toward something else.
 */
const GAZE_HYSTERESIS_DEG = 4;

const CONE = Math.cos((GAZE_CONE_DEG * Math.PI) / 180);

/**
 * Decides which object the visitor is facing, and tells the store.
 *
 * Renders nothing. It exists because the alternative — clicking to read — is a
 * discovery problem wearing an interaction's clothes: a recruiter lands on
 * Venus, sees four silent slabs, and has to work out that slabs are clickable
 * before the site tells them anything. Facing something is not a decision the
 * visitor has to learn how to make.
 *
 * Two design notes worth keeping:
 *
 * **Angles, not screen-space.** Projecting each object to NDC and taking the
 * one nearest the centre would work, and would silently change behaviour with
 * window shape — the same object sits at a different NDC x on a phone and a
 * monitor. The angle between the view direction and the object is a property of
 * the world, so the cone means the same thing on every viewport.
 *
 * **The store is written only when the winner changes.** The comparison runs
 * every frame and lives entirely on refs and stack values; `setGaze` is a
 * discrete flip that re-renders the panel. That is invariant 1, and it is the
 * only reason a per-frame gaze system is affordable — writing the current angle
 * into the store each frame would re-render every subscriber 60 times a second.
 */
export default function GazeFocus({ planet }: { planet: Planet }) {
  const placed = useMemo(() => propLayout(planet), [planet]);
  const setGaze = useSystemStore((s) => s.setGaze);

  // World positions, computed once. The props never move and the camera never
  // translates, so this is the only allocation the component makes.
  const targets = useMemo(
    () =>
      placed.map((prop) => ({
        id: prop.id,
        // propLayout is relative to the surface group; the camera reports world
        // space, so lift these into it once rather than converting every frame.
        position: new Vector3(...prop.position)
          .add(SURFACE_ORIGIN)
          // Aim at roughly the middle of an object rather than its base, or
          // looking straight at a monolith would score worse than looking at
          // the ground in front of it.
          .setY(SURFACE_ORIGIN.y + 1.6),
      })),
    [placed]
  );

  const forward = useRef(new Vector3());
  const toTarget = useRef(new Vector3());
  const current = useRef<string | null>(null);

  useFrame((state) => {
    if (targets.length === 0) return;

    state.camera.getWorldDirection(forward.current);

    let bestId: string | null = null;
    let bestDot = CONE;

    for (const target of targets) {
      toTarget.current.copy(target.position).sub(state.camera.position);
      const length = toTarget.current.length();
      if (length === 0) continue;
      // Both vectors unit-length, so the dot product *is* cos(angle) — larger
      // means closer to dead centre. Comparing cosines avoids an acos per
      // object per frame and orders identically over the range that matters.
      const dot = toTarget.current.dot(forward.current) / length;
      if (dot > bestDot) {
        bestDot = dot;
        bestId = target.id;
      }
    }

    // Apply the dead zone. The incumbent is re-measured against the same cone,
    // so it drops out entirely once it leaves the cone — but while it is still
    // inside, a challenger has to beat it by the hysteresis margin.
    if (bestId !== current.current && current.current !== null) {
      const incumbent = targets.find((t) => t.id === current.current);
      if (incumbent) {
        toTarget.current.copy(incumbent.position).sub(state.camera.position);
        const length = toTarget.current.length();
        const incumbentDot =
          length === 0 ? -1 : toTarget.current.dot(forward.current) / length;

        if (incumbentDot > CONE) {
          const margin =
            Math.acos(Math.min(1, Math.max(-1, incumbentDot))) -
            Math.acos(Math.min(1, Math.max(-1, bestDot)));
          if (margin < (GAZE_HYSTERESIS_DEG * Math.PI) / 180) {
            bestId = current.current;
          }
        }
      }
    }

    if (bestId === current.current) return;
    current.current = bestId;
    setGaze(bestId);
  });

  return null;
}
