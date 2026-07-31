/**
 * Timing for the two transitions between orbit and a surface.
 *
 * Neither is a continuous camera move onto a sphere — both are film cuts. The
 * hard part is that each half runs on a different clock: the camera moves in
 * useFrame, driven by the render loop, and the veil runs in CSS, driven by the
 * compositor. They will drift and there is no making them agree.
 *
 * So don't. Order them instead, with margin to spare:
 *
 *     VEIL_DELAY_MS + VEIL_IN_MS  <=  SWAP_MS  <=  MOVE_MS
 *
 * Read left to right: the veil is fully opaque before the scene underneath it
 * is swapped, and the camera is still moving when that happens. Hold it and
 * the swap is invisible *by construction* — behind a solid screen the camera
 * may teleport a thousand units and nobody can tell. Every "the handoff has to
 * land in exactly the right place" problem that made the flight delicate
 * simply does not arise.
 *
 * The two directions are shaped differently on purpose, because they are
 * different events.
 */

/**
 * Going down: a dive, hidden almost immediately.
 *
 * The veil starts closing at once and the whole thing is over in about a
 * second, because there is nothing to *watch* — you are falling at a planet
 * and the interesting part is arriving.
 *
 * The gap between SWAP_MS and MOVE_MS is a framing decision rather than slack.
 * The dive runs from the hover position (7 planet radii out) to just above the
 * surface on an ease-out, entering at the speed the flight arrived with. What
 * matters is where it has got to when the screen goes solid at 850/1400 = 0.61
 * — 85% of the way down, about 2 radii from the centre, where the planet
 * subtends ~54 degrees against a 50 degree lens. It more than fills the frame,
 * which is what the cut needs in order to have something to hide behind.
 */
export const DESCENT = {
  MOVE_MS: 1400,
  VEIL_DELAY_MS: 0,
  VEIL_IN_MS: 850,
  SWAP_MS: 1150,
  VEIL_OUT_MS: 900,
} as const;

/**
 * Going up: a launch you actually watch.
 *
 * Inverted from the descent in every respect, and deliberately. The veil holds
 * off for the first 1.6 seconds so the rocket can light, leave the pad and
 * climb with the camera chasing it. Only then does the screen close.
 *
 * The veil is also *black* rather than the planet's colour. Fading up through
 * an accent reads as entering an atmosphere, which is right on the way in and
 * exactly wrong on the way out — it flashed the screen bright at the moment
 * you were supposedly leaving for space. Now the sky itself darkens as the
 * rocket climbs (SurfaceScene fades the background and thins the fog), so the
 * veil closes black over an already-black sky and is barely perceptible as a
 * veil at all. The ascent does the visual work; the veil only covers the swap.
 */
export const ASCENT = {
  MOVE_MS: 2600,
  VEIL_DELAY_MS: 1600,
  VEIL_IN_MS: 700,
  SWAP_MS: 2400,
  VEIL_OUT_MS: 900,
} as const;

/**
 * Reduced motion: same cuts, no journey.
 *
 * The transition still has to be *seen* to be understood — jumping instantly
 * from orbit to a surface with no visual connection is more disorienting than
 * a slow move, not less. So the veil stays, just brief, and the camera moves
 * are skipped entirely. The ordering invariant holds here too.
 */
const REDUCED = {
  MOVE_MS: 0,
  VEIL_DELAY_MS: 0,
  VEIL_IN_MS: 160,
  SWAP_MS: 220,
  VEIL_OUT_MS: 200,
} as const;

export type CutTiming = {
  MOVE_MS: number;
  VEIL_DELAY_MS: number;
  VEIL_IN_MS: number;
  SWAP_MS: number;
  VEIL_OUT_MS: number;
};

/** Which way through the cut we are going. */
export type CutDirection = "down" | "up";

export function cutTiming(
  direction: CutDirection,
  reduced: boolean
): CutTiming {
  if (reduced) return REDUCED;
  return direction === "down" ? DESCENT : ASCENT;
}

/**
 * The beat between arriving beside a planet and starting to fall toward it.
 *
 * Zero, and the reasoning is worth keeping because the first version held for
 * 600ms on purpose.
 *
 * The argument for a hold was that the flight decelerated into its arrival and
 * the dive accelerated out of it, so butting them together put two flat spots
 * back to back. That diagnosis was right and the fix was wrong: separating two
 * dead stops with a pause does not hide them, it announces them.
 *
 * The real fix was upstream in the easing. The flight now coasts in still
 * moving and the descent picks that speed up rather than rebuilding it, so
 * there is no flat spot left for a beat to paper over. Left as a knob because
 * it is the obvious thing to reach for if the approach ever wants breathing
 * room — but reach for it knowing a pause is a symptom fix.
 */
export const ARRIVAL_HOLD_MS = 0;
