"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import {
  buildFlightPath,
  easeInOutCubic,
  type Flight as Path,
} from "@/lib/flightPath";
import {
  CAMERA_FOV,
  HOVER_DISTANCE_FACTOR,
  hoverPosition,
} from "@/lib/framing";
import { getPlanet } from "@/lib/planets";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Fraction of the trip spent turning to face the destination. */
const TURN_FRACTION = 0.4;
/** Extra degrees of field of view at peak speed — the sense of acceleration. */
const SPEED_FOV_BOOST = 9;

type ActiveFlight = Path & {
  elapsed: number;
  /** What we were looking at when we launched. */
  lookFrom: Vector3;
  /** The planet we're flying to. */
  lookTo: Vector3;
};

/**
 * The flight, flown from the cockpit.
 *
 * There is no rocket model in the scene because the camera *is* the rocket —
 * the whole experience is first person, so the system view is what you see
 * out of the window while hovering, and a flight simply moves the window.
 *
 * Two consequences fall out of that, and both were bugs in the third-person
 * version this replaces:
 *
 *  - The curve starts at the camera's current position, never at the sun or
 *    at the planet we're parked beside. Starting anywhere else means
 *    teleporting the viewer there before the flight begins.
 *  - The flight ends exactly at the hover position CameraRig would choose,
 *    looking exactly at the planet. Any disagreement between the two shows up
 *    as a swing at the moment of handoff.
 */
export default function Flight() {
  const phase = useSystemStore((s) => s.phase);
  const travelToId = useSystemStore((s) => s.travelToId);
  const focusedId = useSystemStore((s) => s.focusedId);
  const arrive = useSystemStore((s) => s.arrive);
  const reduced = useReducedMotion();
  const { camera } = useThree();

  const flight = useRef<ActiveFlight | null>(null);

  // Scratch vectors, allocated once — allocating inside useFrame feeds the
  // garbage collector 60 times a second and shows up as frame hitches.
  const position = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const planetPosition = useRef(new Vector3());
  const destination = useRef(new Vector3());

  useEffect(() => {
    const restoreFov = () => {
      const perspective = camera as PerspectiveCamera;
      if (perspective.isPerspectiveCamera && perspective.fov !== CAMERA_FOV) {
        perspective.fov = CAMERA_FOV;
        perspective.updateProjectionMatrix();
      }
    };

    if (phase !== "traveling" || !travelToId) {
      flight.current = null;
      restoreFov();
      return;
    }

    const target = getPlanetObject(travelToId);
    const planet = getPlanet(travelToId);
    if (!target || !planet) {
      // Nothing to fly to — fail into the arrived state rather than leaving
      // the phase machine stuck mid-flight with no way out.
      arrive();
      return;
    }

    target.getWorldPosition(planetPosition.current);

    // Stop *outside* the planet, at the same spot CameraRig parks at.
    hoverPosition(
      planetPosition.current,
      camera.position,
      planet.size * HOVER_DISTANCE_FACTOR,
      destination.current
    );

    // Reduced motion: arrive without the journey. Put the camera where the
    // flight would have ended so there's still no jump.
    if (reduced) {
      camera.position.copy(destination.current);
      camera.lookAt(planetPosition.current);
      arrive();
      return;
    }

    // What we're currently looking at, so the turn starts from the truth.
    const lookFrom = new Vector3();
    const current = focusedId ? getPlanetObject(focusedId) : null;
    if (current) current.getWorldPosition(lookFrom);

    flight.current = {
      // Launch from wherever the viewer actually is.
      ...buildFlightPath(camera.position.clone(), destination.current.clone()),
      elapsed: 0,
      lookFrom,
      lookTo: planetPosition.current.clone(),
    };

    return restoreFov;
  }, [phase, travelToId, focusedId, reduced, arrive, camera]);

  useFrame((_state, delta) => {
    const active = flight.current;
    if (!active) return;

    active.elapsed += delta;
    const progress = Math.min(active.elapsed / active.duration, 1);
    const t = easeInOutCubic(progress);

    // getPointAt walks the curve by arc length rather than raw parameter.
    // Without it a bezier travels faster through its straighter stretches and
    // the flight would surge and slow for no visible reason.
    active.curve.getPointAt(t, position.current);
    camera.position.copy(position.current);

    // Swing to face the destination over the opening stretch, then hold it.
    // Turning first and travelling second is what reads as a vehicle with a
    // heading, rather than a camera sliding sideways while staring ahead.
    const turn = easeInOutCubic(Math.min(progress / TURN_FRACTION, 1));
    lookAt.current.copy(active.lookFrom).lerp(active.lookTo, turn);
    camera.lookAt(lookAt.current);

    // Widen the lens at peak speed and return it by arrival. From inside a
    // cockpit this is most of the sensation of accelerating; without it the
    // motion is smooth but weightless.
    const perspective = camera as PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      perspective.fov = CAMERA_FOV + Math.sin(progress * Math.PI) * SPEED_FOV_BOOST;
      perspective.updateProjectionMatrix();
    }

    if (progress >= 1) {
      flight.current = null;
      if (perspective.isPerspectiveCamera) {
        perspective.fov = CAMERA_FOV;
        perspective.updateProjectionMatrix();
      }
      // We are already exactly where CameraRig wants us, so the handoff moves
      // nothing.
      arrive();
    }
  });

  return null;
}
