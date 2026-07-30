"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SYSTEM_EXTENT, SUN_RADIUS, getPlanet } from "@/lib/planets";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** How close the camera parks relative to a planet's radius. */
const FOCUS_DISTANCE_FACTOR = 7;
/** Stop animating once we're this close, so the ease doesn't run forever. */
const ARRIVAL_EPSILON = 0.05;

/**
 * Owns the camera.
 *
 * Two things want to drive it: OrbitControls (the visitor dragging) and the
 * scripted ease that runs when a planet is selected. Both writing to
 * camera.position in the same frame produces a fight the user feels as
 * stutter, so ownership is exclusive: while `animating` is true the controls
 * are switched off, and they're handed back the moment the camera arrives.
 */
export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const focusedId = useSystemStore((s) => s.focusedId);
  const reduced = useReducedMotion();

  // Scratch vectors allocated once. Allocating a Vector3 inside useFrame
  // means 60 allocations a second feeding the garbage collector, which shows
  // up as periodic frame hitches.
  const desiredTarget = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const offset = useRef(new Vector3());

  const animating = useRef(false);

  // A new selection starts a new scripted move. The frame loop below picks
  // this up; nothing is computed here because the target planet is still
  // orbiting and its position is only valid at the moment it's read.
  useEffect(() => {
    animating.current = true;
  }, [focusedId]);

  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Where should we be looking? A focused planet's live world position,
    // or the sun when nothing is selected.
    if (focusedId) {
      const object = getPlanetObject(focusedId);
      if (object) object.getWorldPosition(desiredTarget.current);
    } else {
      desiredTarget.current.set(0, 0, 0);
    }

    if (!animating.current) {
      // Idle: the visitor is in charge. Keep following a focused planet as it
      // orbits, but leave camera position entirely to OrbitControls.
      controls.target.copy(desiredTarget.current);
      controls.update();
      return;
    }

    // Approach along the camera's current viewing direction, so selecting a
    // planet moves us closer without also swinging us around to a new side.
    // Preserving the visitor's chosen angle is what keeps this from feeling
    // like the camera is yanking control away.
    const planet = focusedId ? getPlanet(focusedId) : undefined;
    const distance = planet
      ? planet.size * FOCUS_DISTANCE_FACTOR
      : SYSTEM_EXTENT * 1.45;

    offset.current.copy(camera.position).sub(desiredTarget.current);
    if (offset.current.lengthSq() < 1e-6) offset.current.set(0, 0.4, 1);
    offset.current.normalize().multiplyScalar(distance);
    // Lift the eye a little above the orbital plane so planets don't read as
    // a flat line when we get close.
    offset.current.y += distance * 0.22;

    desiredPosition.current.copy(desiredTarget.current).add(offset.current);

    if (reduced) {
      // No sweeping motion for visitors who asked not to have any: cut
      // straight to the destination.
      camera.position.copy(desiredPosition.current);
      controls.target.copy(desiredTarget.current);
    } else {
      // Frame-rate independent easing. A plain lerp(x, 0.1) moves 10% per
      // *frame*, so it's twice as fast at 120Hz as at 60Hz. Raising a decay
      // constant to the power of delta makes it 10% per *second* instead.
      const k = 1 - Math.pow(0.0015, delta);
      camera.position.lerp(desiredPosition.current, k);
      controls.target.lerp(desiredTarget.current, k);
    }

    controls.update();

    // Arrived: return the camera to the visitor.
    if (camera.position.distanceTo(desiredPosition.current) < ARRIVAL_EPSILON) {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      // makeDefault lets other drei helpers discover these controls rather
      // than each grabbing the camera independently.
      makeDefault
      // Disabled mid-flight so dragging can't fight the scripted move.
      enabled={!animating.current}
      enablePan={false}
      enableDamping={!reduced}
      dampingFactor={0.06}
      // The clamps are the whole "hybrid" control scheme: free enough to
      // explore, bounded so nobody ever loses the sun and bounces.
      minDistance={SUN_RADIUS * 1.6}
      maxDistance={SYSTEM_EXTENT * 2.6}
      // Never quite reach top-down or edge-on; both angles read as broken.
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
    />
  );
}
