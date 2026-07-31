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
  // lifting it above the orbital plane bows the path into an arc. A straight
  // line between two planets reads as a slide across a flat image; the arc is
  // what sells depth.
  //
  // Kept shallow because this is flown first person. The swoop that looked
  // dramatic watching a rocket from outside becomes a stomach-drop when it's
  // your own viewpoint being thrown up and over.
  const control = start.clone().lerp(end, 0.5);
  control.y += Math.max(distance * 0.16, 2.2);

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
 *
 * Still used for the *turn* — swinging to face the destination genuinely does
 * want to settle — but no longer for the travel itself. See below.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Fraction of the trip spent accelerating before settling into a cruise. */
const COAST_FRACTION = 0.4;

/**
 * Accelerate away, then hold that speed all the way in.
 *
 * The flight used to run on easeInOutCubic, which arrives at exactly zero
 * velocity — and a landing always follows a flight now, so that stop was
 * pure dead air. The descent then had to build speed again from nothing, and
 * the two flat spots met at the same instant. No amount of shortening the
 * pause between them fixes that, because the pause was never the problem: the
 * *momentum* was going to zero either way.
 *
 * So this ramps up over the opening stretch and then coasts, arriving at about
 * 1.25x average speed with the camera still moving. The descent picks that
 * motion up rather than starting it (see Descent.tsx), which is what turns two
 * moves into one continuous approach.
 *
 * Deceleration is not missing by accident — nothing here ever has to stop.
 */
export function easeInCoast(t: number): number {
  const p = COAST_FRACTION;
  // Normalised so the whole trip still covers exactly 1 in exactly 1.
  const norm = 1 - p / 2;
  if (t < p) return (t * t) / (2 * p) / norm;
  return (p / 2 + (t - p)) / norm;
}

/**
 * Speed along that ease, normalised to peak at 1.
 *
 * Broken out because the field-of-view cue should follow how fast you are
 * actually going rather than a sine of progress. Tied to progress, the lens
 * narrows back to normal exactly as you arrive — a visible "settling" on the
 * frame before the descent, which is the opposite of the read we want.
 */
export function easeInCoastSpeed(t: number): number {
  return t < COAST_FRACTION ? t / COAST_FRACTION : 1;
}
