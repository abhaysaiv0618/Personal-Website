"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SYSTEM_EXTENT, SUN_RADIUS, getPlanet } from "@/lib/planets";
import {
  fitSystemDistance,
  hoverPosition,
  HOVER_DISTANCE_FACTOR,
  viewDirectionForAspect,
} from "@/lib/framing";
import { getPlanetObject } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Planets orbit about world Y, so keeping station means turning about it too. */
const ORBIT_AXIS = new Vector3(0, 1, 0);
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
  const phase = useSystemStore((s) => s.phase);
  const reduced = useReducedMotion();
  /**
   * Whether this rig currently owns the camera.
   *
   * Every other phase hands it to someone else: `traveling` to Flight,
   * `descending`/`departing` to Descent, `surface` to SurfaceControls. Stated
   * as one positive condition rather than a growing list of things to exclude,
   * so a phase added later defaults to *not* letting this rig drive — the safe
   * direction. A forgotten exclusion is a camera fight; a forgotten inclusion
   * is a camera that sits still and is obvious in one second of testing.
   */
  const rigOwns = phase === "system" || phase === "focused";

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

  // Station-keeping: where the focused planet was last frame, and our
  // displacement from it. Re-anchored to the planet's real position every
  // frame rather than integrated, so nothing accumulates drift.
  const lastTargetPosition = useRef(new Vector3());
  const stationOffset = useRef(new Vector3());
  const hasStation = useRef(false);

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

    // Somebody else owns the camera right now. Yielding entirely — rather
    // than blending — is what keeps their shot clean; two components easing
    // the same object toward different targets is the stutter this whole
    // ownership scheme exists to avoid.
    if (!rigOwns) {
      // Our record of the planet's position goes stale while they drive, so
      // drop it. The first frame after we get the camera back re-establishes
      // it, which is also what stops a return from the surface — where the
      // camera was a thousand units away — from being read as orbital drift.
      hasStation.current = false;
      return;
    }

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
      lastTargetPosition.current.copy(desiredTarget.current);
      hasStation.current = true;
      return;
    }

    // First frame back after somebody else drove the camera — the end of a
    // flight, or a return from a surface.
    //
    // Take the camera exactly as handed over. Whoever was driving already put
    // it where it belongs: Flight ends on the very hover position this rig
    // would pick (hoverPosition is idempotent, and orbits are frozen mid-
    // flight so the planet has not moved), and Descent snaps to that same spot
    // on the way back. There is nothing to ease toward.
    //
    // But `controls.target` is stale — it still points at wherever we were
    // looking when we handed the camera over, usually the planet we just left.
    // And OrbitControls.update() *forces* camera.lookAt(target). So easing the
    // target across, as the scripted move below does, whips the whole view
    // around to the old planet on the handoff frame and then swings it back.
    // That is the "screen turns the other way" at the end of every flight.
    //
    // Snapping the target first makes update() a no-op: offset is measured
    // from the new target, so the position it writes back is the position it
    // already had, and the lookAt matches what Flight was showing. Nothing
    // moves.
    if (!hasStation.current) {
      controls.target.copy(desiredTarget.current);
      controls.update();
      lastTargetPosition.current.copy(desiredTarget.current);
      hasStation.current = true;
      animating.current = false;
      return;
    }

    if (!animating.current) {
      const parked = focusedId ? getPlanet(focusedId) : undefined;

      if (parked && hasStation.current) {
        // Fly in formation rather than watching from a fixed point in space.
        //
        // Only aiming the camera at a moving planet leaves you anchored to a
        // spot the planet steadily leaves behind — it shrinks into the
        // distance while you stare after it. Keeping station means matching
        // its orbital motion so it holds still relative to you.
        //
        // Two parts, because the planet is doing two things: it translates,
        // so we re-anchor to its new position; and its whole orbit sweeps
        // about the sun, so our displacement rotates about the same world
        // axis by the same angle. Translating alone would keep the distance
        // but let us slew around the planet as the orbit carried it past.
        //
        // Camera and target move by the same rigid transform, which leaves
        // the spherical relationship OrbitControls tracks untouched — so
        // dragging to look around still works normally on top of this.
        stationOffset.current
          .copy(camera.position)
          .sub(lastTargetPosition.current)
          .applyAxisAngle(ORBIT_AXIS, delta * parked.orbitSpeed);
        camera.position.copy(desiredTarget.current).add(stationOffset.current);
      }

      controls.target.copy(desiredTarget.current);
      controls.update();
      lastTargetPosition.current.copy(desiredTarget.current);
      hasStation.current = true;
      return;
    }

    const planet = focusedId ? getPlanet(focusedId) : undefined;

    if (planet) {
      // Park outside the planet, on the side we approached from. Shared with
      // Flight so both agree on a single destination — the function is
      // idempotent, so arriving from a flight leaves nothing to correct and
      // the handoff is invisible.
      hoverPosition(
        desiredTarget.current,
        camera.position,
        planet.size * HOVER_DISTANCE_FACTOR,
        desiredPosition.current
      );
      offset.current.copy(desiredPosition.current).sub(desiredTarget.current);
    } else {
      // Returning to the overview restores the solved framing outright — the
      // identical expression used for the first-frame snap above, so the view
      // you come back to is provably the view you loaded on.
      //
      // Nothing is carried over from the focused camera. Direction and
      // distance are one answer, not two independent numbers: the solver
      // finds the closest distance at which the outer ring stays on screen
      // *for a specific angle*, so substituting either one voids it. And the
      // inherited direction is arbitrary anyway — the camera was parked
      // wherever its planet happened to be in orbit, which is a position the
      // visitor never chose.
      offset.current.copy(viewDirection).multiplyScalar(systemDistance);
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

    // Keep the station record current through the scripted move too, so the
    // first idle frame afterwards holds formation instead of skipping one.
    lastTargetPosition.current.copy(desiredTarget.current);
    hasStation.current = true;

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
      // Disabled mid-move so dragging can't fight the scripted camera, and
      // disabled outright whenever another component owns the camera —
      // damping alone is enough to keep writing to a position Descent or
      // SurfaceControls just set.
      enabled={!animating.current && rigOwns}
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
