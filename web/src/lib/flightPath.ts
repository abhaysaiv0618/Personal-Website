import { MathUtils, QuadraticBezierCurve3, Vector3 } from "three";

/** Shortest and longest a trip may take, in seconds. */
const MIN_DURATION = 1.6;
const MAX_DURATION = 3.4;

export type Flight = {
  curve: QuadraticBezierCurve3;
  duration: number;
};

/**
 * Builds the arc the rocket flies, from wherever we are to the target planet.
 *
 * A curve turns animation into a lookup: getPointAt(t) returns a position for
 * any t in 0..1, so "animate the rocket" becomes "advance a number and read
 * the result". The useful consequence is that shape and pacing decouple — the
 * curve owns *where* the path goes, the easing below owns *how fast* you move
 * along it, and either can change without touching the other.
 */
export function buildFlightPath(start: Vector3, end: Vector3): Flight {
  const distance = start.distanceTo(end);

  // The control point pulls the curve toward it without being touched, so
  // lifting it above the orbital plane bows the path into a visible arc. A
  // straight line between two planets reads as a slide across a flat image;
  // the arc is what sells depth.
  const control = start.clone().lerp(end, 0.5);
  control.y += Math.max(distance * 0.34, 4);

  return {
    curve: new QuadraticBezierCurve3(start.clone(), control, end.clone()),
    // Sub-linear in distance: crossing the whole system should feel longer
    // than hopping between neighbours, but not six times longer. Nobody wants
    // to sit through a proportional trip to the outermost planet.
    duration: MathUtils.clamp(
      1.1 + Math.sqrt(distance) * 0.28,
      MIN_DURATION,
      MAX_DURATION
    ),
  };
}

/**
 * Ease-in-out cubic: accelerate away, coast, decelerate in.
 *
 * Pacing is the whole difference between a vehicle and a slide. Feeding raw
 * linear t into the curve gives motion that starts and stops at full speed,
 * which reads as mechanical no matter how good the path is.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
