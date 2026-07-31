"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { ARRIVAL_HOLD_MS, cutTiming } from "@/lib/cut";
import { getApproach, rememberApproach } from "@/lib/cameraMemory";
import {
  CAMERA_FOV,
  HOVER_DISTANCE_FACTOR,
  hoverPosition,
} from "@/lib/framing";
import { getPlanet } from "@/lib/planets";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore, type Phase } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Extra degrees of lens at the bottom of the dive — the plunge cue. */
const DIVE_FOV_BOOST = 13;
/** How far the camera lifts off the surface during departure. */
const LIFT_DISTANCE = 30;
/** Stop the dive just clear of the surface, as a multiple of planet radius. */
const DIVE_FLOOR = 1.05;

/**
 * The dive down and the lift back off — the camera owner during `descending`
 * and `departing`.
 *
 * Both moves have a property nothing else in this codebase has: **they are
 * allowed to end anywhere.** The veil is opaque before either finishes (see
 * lib/cut.ts), so where the camera happens to be at the moment of the swap is
 * unobservable. That is the entire reason the landing was affordable. The
 * flight had to end on exactly the point CameraRig would independently choose,
 * or the handoff visibly corrected itself; here there is no such constraint in
 * either direction, and the two scenes are a thousand units apart.
 *
 * The one moment that *is* constrained is the return, and it's constrained by
 * the opposite reasoning — see the snap in the layout effect below.
 */
export default function Descent() {
  const phase = useSystemStore((s) => s.phase);
  const focusedId = useSystemStore((s) => s.focusedId);
  const land = useSystemStore((s) => s.land);
  const reduced = useReducedMotion();
  const { camera } = useThree();

  const timing = cutTiming(reduced);

  const elapsed = useRef(0);
  const from = useRef(new Vector3());
  const target = useRef(new Vector3());
  const planetPosition = useRef(new Vector3());
  const previousPhase = useRef<Phase>("system");

  useLayoutEffect(() => {
    const wasPhase = previousPhase.current;
    previousPhase.current = phase;
    elapsed.current = 0;

    if (phase === "descending") {
      // Remember where we're leaving from before the dive moves us. This is
      // the only chance to capture it: by the time we return, the camera has
      // been on a surface and the original vantage is gone.
      rememberApproach(camera.position);
      from.current.copy(camera.position);
      return;
    }

    if (phase === "departing") {
      from.current.copy(camera.position);
      return;
    }

    // Just arrived from a flight. Selecting a planet means going to it and
    // landing on it — one gesture, not two — so the descent starts on its own
    // after a short beat rather than waiting for a second click.
    //
    // The beat matters: the flight decelerates into its arrival and the dive
    // accelerates out of it, and butting those together reads as one lurch
    // with a kink in the middle rather than as two moves. Holding briefly lets
    // the arrival land as its own event.
    if (phase === "focused" && wasPhase === "traveling") {
      const timer = setTimeout(land, ARRIVAL_HOLD_MS);
      return () => clearTimeout(timer);
    }

    // Back in orbit after a landing. Put the camera exactly where it was when
    // it left, right now, in a layout effect rather than on the next frame.
    //
    // This is the one place in the whole sequence with a deadline. The veil is
    // opaque at this instant but has already started its ~900ms opening, and
    // the camera is currently standing on a surface a thousand units below the
    // system. If a frame renders before this runs, OrbitControls' update()
    // aims the camera at a planet from down there and paints a frame of
    // nothing — increasingly visible as the veil lifts. useLayoutEffect runs
    // synchronously on commit, before paint and before the next animation
    // frame, so the wrong frame never exists.
    //
    // Guarded on the previous phase because arriving here from a *flight* must
    // not be touched: Flight already landed the camera on the correct hover
    // position, and the remembered approach would be from some earlier visit
    // to a different planet entirely.
    if (phase === "focused" && wasPhase === "departing" && focusedId) {
      const object = getPlanetObject(focusedId);
      const planet = getPlanet(focusedId);
      if (!object || !planet) return;

      object.getWorldPosition(planetPosition.current);
      hoverPosition(
        planetPosition.current,
        // Idempotent: handing back the exact position we left from returns
        // that same position, so CameraRig picks up with nothing to correct.
        getApproach(),
        planet.size * HOVER_DISTANCE_FACTOR,
        target.current
      );
      camera.position.copy(target.current);
      camera.lookAt(planetPosition.current);

      const perspective = camera as PerspectiveCamera;
      if (perspective.isPerspectiveCamera && perspective.fov !== CAMERA_FOV) {
        perspective.fov = CAMERA_FOV;
        perspective.updateProjectionMatrix();
      }
    }
  }, [phase, focusedId, camera, land]);

  useFrame((_state, delta) => {
    if (phase !== "descending" && phase !== "departing") return;
    // Reduced motion: hold still and let the veil carry the whole transition.
    // The cut still reads, because a cut is a change of place, not a move.
    if (timing.DESCENT_MS <= 0) return;

    elapsed.current += delta;
    const progress = Math.min(elapsed.current / (timing.DESCENT_MS / 1000), 1);
    // Quadratic ease-in: accelerating throughout, never decelerating. The
    // flight's ease-in-out would be wrong here — we cut away mid-move, so the
    // deceleration half would simply never be seen, and any easing that slows
    // before the cut reads as the fall losing its nerve.
    const eased = progress * progress;

    if (phase === "descending") {
      const object = focusedId ? getPlanetObject(focusedId) : null;
      const planet = focusedId ? getPlanet(focusedId) : undefined;
      if (!object || !planet) return;

      // Re-read the planet's position every frame rather than baking it at
      // launch the way Flight does. Flight has to freeze the orbits because
      // its bezier is built once and would otherwise aim at where the planet
      // used to be; a lerp toward a live target self-corrects, so the system
      // keeps turning right up to the moment it's hidden.
      object.getWorldPosition(planetPosition.current);

      // Stop just clear of the surface rather than at the centre, so the dive
      // never ends up inside the geometry it's diving at.
      target.current
        .copy(from.current)
        .sub(planetPosition.current)
        .normalize()
        .multiplyScalar(planet.size * DIVE_FLOOR)
        .add(planetPosition.current);

      camera.position.lerpVectors(from.current, target.current, eased);
      camera.lookAt(planetPosition.current);

      // Widen the lens as speed builds. Same trick as the flight's speed cue,
      // and here it never has to be wound back — SurfaceControls sets the lens
      // outright when it stands you up on the other side of the cut.
      const perspective = camera as PerspectiveCamera;
      if (perspective.isPerspectiveCamera) {
        perspective.fov = CAMERA_FOV + eased * DIVE_FOV_BOOST;
        perspective.updateProjectionMatrix();
      }
      return;
    }

    // Departing: rise off the surface. Translation only, deliberately — no
    // rotation. SurfaceControls has already unmounted and restored the
    // camera's Euler order, so turning the head here would mean reasoning
    // about which order is in force partway through a move nobody can see.
    camera.position.y = from.current.y + eased * LIFT_DISTANCE;
  });

  return null;
}
