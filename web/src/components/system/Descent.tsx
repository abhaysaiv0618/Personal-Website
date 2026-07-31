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
import {
  CHASE_GAP,
  SURFACE_ORIGIN,
  rocketAscent,
  rocketPlacement,
} from "@/lib/surface";
import { useSystemStore, type Phase } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Extra degrees of lens at the bottom of the dive — the plunge cue. */
const DIVE_FOV_BOOST = 13;
/** Stop the dive just clear of the surface, as a multiple of planet radius. */
const DIVE_FLOOR = 1.05;
/** Fraction of the ascent spent swinging to face the rocket. */
const LAUNCH_TURN_FRACTION = 0.18;

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
  const size = useThree((s) => s.size);

  const timing = cutTiming(phase === "departing" ? "up" : "down", reduced);

  const elapsed = useRef(0);
  const from = useRef(new Vector3());
  const target = useRef(new Vector3());
  const planetPosition = useRef(new Vector3());
  const previousPhase = useRef<Phase>("system");
  /** Where the visitor was looking when the launch began, so the turn to
   *  follow the rocket starts from the truth rather than snapping. */
  const lookFrom = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const rocketPosition = useRef(new Vector3());
  /**
   * The lens as the flight handed it over — already widened by the approach.
   * The dive widens further *from here* rather than from the resting value, so
   * the field of view never snaps back between the two moves.
   */
  const startFov = useRef(CAMERA_FOV);

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

      // Inherit the lens instead of resetting it. Arriving straight from a
      // flight this is already wide; re-landing from a standing start at
      // `focused` it is simply CAMERA_FOV, and the dive widens from there.
      const perspective = camera as PerspectiveCamera;
      startFov.current = perspective.isPerspectiveCamera
        ? perspective.fov
        : CAMERA_FOV;
      return;
    }

    if (phase === "departing") {
      from.current.copy(camera.position);
      // Whatever the visitor had turned to face. The camera swings from here
      // to the rocket over the opening moments rather than cutting to it —
      // they may well have been looking the other way when they hit the
      // button, and snapping the view round is the jolt this whole sequence
      // exists to avoid.
      camera.getWorldDirection(lookFrom.current);
      lookFrom.current.multiplyScalar(20).add(camera.position);
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
    if (timing.MOVE_MS <= 0) return;

    elapsed.current += delta;
    const progress = Math.min(elapsed.current / (timing.MOVE_MS / 1000), 1);
    // Ease *out*: enter fast and shed speed on the way in.
    //
    // This is a reversal, and the reason is worth keeping. While the descent
    // began from a standstill after a pause, accelerating was obviously right
    // and decelerating would have read as the fall losing its nerve. Once the
    // flight started coasting in still moving, that inverted — the dive's job
    // stopped being to build momentum and became to *receive* it. Measured
    // across real trips, starting from rest meant up to a 7.8x speed drop on
    // the frame the flight handed over: a stall, exactly the thing the pause
    // was removed to avoid. Entering at 2x average puts the join within about
    // 2x in either direction on every trip.
    //
    // It also frames the cut better. By the time the veil is fully opaque
    // (61% of the way through) an ease-out has covered 85% of the descent, so
    // the planet subtends ~54 degrees against a 50 degree lens — it more than
    // fills the frame. Nobody ever sees the deceleration finish, because the
    // screen is solid long before it does.
    //
    // A real landing brakes. That it also solves the handoff is the useful
    // part.
    const remaining = 1 - progress;
    const eased = 1 - remaining * remaining;

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

      // Widen the lens further as the fall speeds up, continuing from whatever
      // the flight left rather than from the resting value — the two moves
      // share one uninterrupted ramp. It never has to be wound back:
      // SurfaceControls sets the lens outright when it stands you up on the
      // other side of the cut.
      const perspective = camera as PerspectiveCamera;
      if (perspective.isPerspectiveCamera) {
        const target = CAMERA_FOV + DIVE_FOV_BOOST;
        perspective.fov =
          startFov.current + (target - startFov.current) * eased;
        perspective.updateProjectionMatrix();
      }
      return;
    }

    // Departing: chase the rocket off the pad.
    //
    // This one move is not hidden — the veil holds off for the first 1.6
    // seconds precisely so it can be watched — which makes it the only
    // scripted camera move in the codebase that has to look good rather than
    // merely end in the right place.
    //
    // The rocket's height comes from the same pure function SurfaceScene uses
    // to draw it, so the camera cannot end up chasing a position the rocket
    // isn't at. Sharing a mutable object through a registry would work too,
    // but two readers of one pure function have nothing to keep in sync.
    const climb = rocketAscent(progress);
    const offset = rocketPlacement(size.width / Math.max(size.height, 1));

    rocketPosition.current.set(
      SURFACE_ORIGIN.x + offset[0],
      SURFACE_ORIGIN.y + offset[1] + climb,
      SURFACE_ORIGIN.z + offset[2]
    );

    // Stay put until the rocket has cleared CHASE_GAP, then hold station just
    // below it. Waiting is what sells the launch: you watch it leave the
    // ground from where you're standing, and only then go up after it. Rising
    // immediately would read as the whole world sinking instead.
    camera.position.y = from.current.y + Math.max(0, climb - CHASE_GAP);

    // Swing to face the rocket over the opening stretch, then track it.
    const turn = Math.min(progress / LAUNCH_TURN_FRACTION, 1);
    lookAt.current
      .copy(lookFrom.current)
      .lerp(rocketPosition.current, turn * turn * (3 - 2 * turn));
    camera.lookAt(lookAt.current);
  });

  return null;
}
