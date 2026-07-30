"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SYSTEM_EXTENT, SUN_RADIUS, getPlanet } from "@/lib/planets";
import { fitSystemDistance, viewDirectionForAspect } from "@/lib/framing";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** How close the camera parks relative to a planet's radius. */
const FOCUS_DISTANCE_FACTOR = 7;
/** Stop animating once we're this close, so the ease doesn't run forever. */
const ARRIVAL_EPSILON = 0.05;
/** Fit a little past the outermost ring so it isn't flush against the edge. */
const FIT_RADIUS = SYSTEM_EXTENT * 1.06;
/**
 * Screen space reserved for the DOM overlay, so the system is never framed
 * underneath it. Bottom is the larger share because the nav ring lives there;
 * the title card up top is transient and semi-transparent.
 */
const FRAME_MARGINS = { top: 0.14, bottom: 0.26, side: 0.06 };

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
  const size = useThree((s) => s.size);
  const focusedId = useSystemStore((s) => s.focusedId);
  const reduced = useReducedMotion();

  // Solved from the live viewport, so a resize reframes instead of clipping.
  // Angle and distance are solved together: the angle adapts to window shape,
  // then the distance is fitted for that angle.
  const { viewDirection, systemDistance } = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const direction = viewDirectionForAspect(aspect);
    return {
      viewDirection: direction,
      systemDistance: fitSystemDistance(
        aspect,
        FIT_RADIUS,
        direction,
        FRAME_MARGINS
      ),
    };
  }, [size.width, size.height]);

  // Scratch vectors allocated once. Allocating a Vector3 inside useFrame
  // means 60 allocations a second feeding the garbage collector, which shows
  // up as periodic frame hitches.
  const desiredTarget = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const offset = useRef(new Vector3());

  const animating = useRef(false);
  const initialised = useRef(false);

  // A new selection starts a new scripted move. Nothing is computed here
  // because the target planet is still orbiting — its position is only valid
  // at the moment it's read, inside the frame loop.
  useEffect(() => {
    animating.current = true;
  }, [focusedId]);

  // Reframe on resize, but only when looking at the whole system; interrupting
  // someone who has focused a planet would be hostile.
  useEffect(() => {
    if (!focusedId) animating.current = true;
  }, [systemDistance, focusedId]);

  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Where should we be looking? A focused planet's live world position, or
    // the sun when nothing is selected.
    if (focusedId) {
      const object = getPlanetObject(focusedId);
      if (object) object.getWorldPosition(desiredTarget.current);
    } else {
      desiredTarget.current.set(0, 0, 0);
    }

    // First frame: snap to the solved framing rather than easing into it, so
    // the page doesn't open on a visible zoom-out.
    if (!initialised.current) {
      camera.position.copy(viewDirection).multiplyScalar(systemDistance);
      controls.target.set(0, 0, 0);
      controls.update();
      initialised.current = true;
      animating.current = false;
      return;
    }

    if (!animating.current) {
      // Idle: the visitor is in charge. Keep following a focused planet as it
      // orbits, but leave camera position entirely to OrbitControls.
      controls.target.copy(desiredTarget.current);
      controls.update();
      return;
    }

    const planet = focusedId ? getPlanet(focusedId) : undefined;

    if (planet) {
      // Zooming in: approach along the camera's current viewing direction, so
      // selecting a planet moves us closer without swinging us to a new side.
      // Preserving the visitor's chosen angle is what keeps this from feeling
      // like the camera is yanking control away.
      const distance = planet.size * FOCUS_DISTANCE_FACTOR;
      offset.current.copy(camera.position).sub(desiredTarget.current);
      if (offset.current.lengthSq() < 1e-6) offset.current.copy(viewDirection);
      offset.current.normalize().multiplyScalar(distance);
      // Lift the eye above the orbital plane so planets don't read as a flat
      // line up close.
      offset.current.y += distance * 0.22;
    } else {
      // Returning to the overview: restore the *solved* elevation and
      // distance rather than reusing whatever direction the camera inherited
      // from the planet it was parked at.
      //
      // Those two values are one answer, not two independent numbers — the
      // fit was computed for a specific angle, so keeping the angle and
      // replacing the distance (or vice versa) silently voids the guarantee
      // that the outer ring stays on screen.
      //
      // The inherited direction is also degenerate near the inner planets: a
      // camera parked just past a planet on the far side of the sun sits
      // almost directly above the origin, and normalising that yields a
      // straight-down vector — the top-down shot with a clipped outer ring.
      //
      // Azimuth is kept so someone who rotated to view from another side
      // stays there; only elevation and distance are restored.
      const azimuth = Math.atan2(camera.position.x, camera.position.z);
      const horizontal =
        Math.hypot(viewDirection.x, viewDirection.z) * systemDistance;
      offset.current.set(
        Math.sin(azimuth) * horizontal,
        viewDirection.y * systemDistance,
        Math.cos(azimuth) * horizontal
      );
    }

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
      // explore, bounded so nobody ever loses the sun and bounces. The zoom
      // ceiling is derived from the solved framing so it always leaves room
      // to pull back past the default view.
      minDistance={SUN_RADIUS * 1.6}
      maxDistance={systemDistance * 1.6}
      // Never quite reach top-down or edge-on; both angles read as broken.
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
    />
  );
}
