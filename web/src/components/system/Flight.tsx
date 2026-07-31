"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Quaternion, Vector3 } from "three";
import { buildFlightPath, easeInOutCubic, type Flight as Path } from "@/lib/flightPath";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import Rocket from "./Rocket";

/** How far behind the rocket the camera trails, and how far above it. */
const CHASE_BACK = 3.1;
const CHASE_UP = 1.15;
/** Lookahead along the curve used for both aiming and orientation. */
const LOOKAHEAD = 0.015;
/** The rocket's local forward axis, which gets rotated onto the heading. */
const ROCKET_UP = new Vector3(0, 1, 0);

type ActiveFlight = Path & { elapsed: number };

/**
 * Owns the rocket and, while it is flying, the camera.
 *
 * CameraRig normally drives the camera and OrbitControls normally drives
 * CameraRig, so this is the third thing that wants the same object. Rather
 * than adding another negotiation, ownership follows the phase machine that
 * already exists: during `traveling` this component drives and CameraRig
 * returns early. One owner per phase, no arbitration logic anywhere.
 */
export default function Flight() {
  const phase = useSystemStore((s) => s.phase);
  const travelToId = useSystemStore((s) => s.travelToId);
  const focusedId = useSystemStore((s) => s.focusedId);
  const arrive = useSystemStore((s) => s.arrive);
  const reduced = useReducedMotion();
  const { camera } = useThree();

  const rocketRef = useRef<Group>(null);
  // The active flight is a three.js curve plus a clock. Neither belongs in the
  // store: the curve is a mutable object and `elapsed` changes every frame.
  const flight = useRef<ActiveFlight | null>(null);

  // Scratch vectors, allocated once — see CameraRig for why.
  const position = useRef(new Vector3());
  const ahead = useRef(new Vector3());
  const heading = useRef(new Vector3());
  const chase = useRef(new Vector3());
  const orientation = useRef(new Quaternion());

  useEffect(() => {
    if (phase !== "traveling" || !travelToId) {
      flight.current = null;
      return;
    }

    const destination = getPlanetObject(travelToId);
    if (!destination) {
      // Nothing to fly to (the planet never mounted) — fail into the arrived
      // state rather than leaving the phase machine stuck mid-flight.
      arrive();
      return;
    }

    // Visitors who asked for reduced motion get the destination, not the
    // journey. A 3-second swooping arc is exactly what that setting exists
    // to prevent.
    if (reduced) {
      arrive();
      return;
    }

    const end = new Vector3();
    destination.getWorldPosition(end);

    // Launch from the planet we're parked at, or from the sun in system view.
    const start = new Vector3();
    const origin = focusedId ? getPlanetObject(focusedId) : null;
    if (origin) origin.getWorldPosition(start);

    flight.current = { ...buildFlightPath(start, end), elapsed: 0 };
  }, [phase, travelToId, focusedId, reduced, arrive]);

  useFrame((_state, delta) => {
    const active = flight.current;
    const rocket = rocketRef.current;
    if (!active || !rocket) return;

    active.elapsed += delta;
    const progress = Math.min(active.elapsed / active.duration, 1);
    const t = easeInOutCubic(progress);

    // getPointAt walks the curve by arc length rather than by raw parameter.
    // Without it a bezier travels faster through its straighter stretches,
    // so the rocket would surge and slow for no visible reason.
    active.curve.getPointAt(t, position.current);
    active.curve.getPointAt(Math.min(t + LOOKAHEAD, 1), ahead.current);

    heading.current.copy(ahead.current).sub(position.current);
    // At t=1 the lookahead collapses to zero length and normalising would
    // produce NaN, which silently corrupts the transform.
    if (heading.current.lengthSq() > 1e-8) {
      heading.current.normalize();
      // Rotate the rocket's local +Y onto the heading. Doing this with Euler
      // angles risks gimbal lock — when two axes align a degree of freedom
      // disappears and the model snaps. Quaternions have no such case.
      orientation.current.setFromUnitVectors(ROCKET_UP, heading.current);
      rocket.quaternion.slerp(orientation.current, 1 - Math.pow(0.0001, delta));
    }

    rocket.position.copy(position.current);

    // Chase camera: behind the rocket along its heading, and above it.
    chase.current
      .copy(position.current)
      .addScaledVector(heading.current, -CHASE_BACK);
    chase.current.y += CHASE_UP;

    // Ease rather than snap, so the camera settles into the chase from
    // wherever it happened to be instead of teleporting on frame one.
    camera.position.lerp(chase.current, 1 - Math.pow(0.0004, delta));
    camera.lookAt(position.current);

    if (progress >= 1) {
      flight.current = null;
      // CameraRig picks up from here and eases into the focused framing.
      arrive();
    }
  });

  if (phase !== "traveling") return null;
  return <Rocket ref={rocketRef} />;
}
