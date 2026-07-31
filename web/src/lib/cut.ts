/**
 * Timing for the landing cut.
 *
 * The landing is not a continuous camera move onto a sphere — it is a film
 * cut. The camera dives at the planet, a veil in the planet's own atmosphere
 * colour closes over the screen, the entire scene is swapped underneath it,
 * and the veil opens on a surface. Two unrelated scenes read as one move.
 *
 * The hard part is that the two halves run on different clocks. The dive lives
 * in useFrame, driven by the render loop and whatever frame rate the GPU
 * manages. The veil lives in CSS, driven by the browser's compositor. They
 * will drift, and there is no way to make them agree exactly.
 *
 * So don't try. Rather than synchronising the two timelines, enforce an
 * ordering between them with margin to spare:
 *
 *     VEIL_IN_MS  <  SWAP_MS  <=  DESCENT_MS
 *
 * Read left to right: the veil is fully opaque well before the scene is
 * swapped, and the camera is still diving when the swap happens. Hold that and
 * the swap is invisible *by construction* — behind a solid screen the camera
 * may teleport a thousand units and nobody can tell. Every "the handoff must
 * land in exactly the right place" problem that made the flight tricky simply
 * does not arise here.
 *
 * Break it in either direction and you see the seam: too small a gap on the
 * left and the new scene pops in through a translucent veil; on the right, the
 * dive finishes and the camera sits frozen at the planet before the cut.
 *
 * A side effect worth keeping: because the dive is cut off partway, its ease
 * should accelerate and never decelerate — see DESCENT_MS.
 */

/**
 * How long the dive would take if it ever ran to completion. It doesn't — the
 * veil goes solid at VEIL_IN_MS and the swap follows at SWAP_MS, both well
 * before this.
 *
 * The gap is not slack, it is a framing decision. The dive runs from the hover
 * position (7 planet radii out) to just above the surface on an ease-out,
 * entering at the speed the flight arrived with. What matters is where the
 * camera has got to by the time the screen is solid at 850/1400 = 0.61: 85% of
 * the way down, about 2 radii from the centre, where the planet subtends ~54
 * degrees against a 50 degree lens. It more than fills the frame, which is
 * what the cut needs in order to have something to hide behind.
 *
 * Stretch this and you are still looking at a small distant planet when the
 * veil lands; shorten it and the camera is pressed into the geometry.
 */
export const DESCENT_MS = 1400;

/** Veil closing: transparent to fully opaque. */
export const VEIL_IN_MS = 850;

/**
 * When the scene is actually swapped. The gap above VEIL_IN_MS is the safety
 * margin — a dropped frame or two around the end of the CSS transition must
 * not be able to expose the swap.
 */
export const SWAP_MS = 1150;

/** Veil opening again, over the new scene. */
export const VEIL_OUT_MS = 900;

/**
 * The beat between arriving beside a planet and starting to fall toward it.
 *
 * Zero, and the reasoning behind that is worth keeping, because the first
 * version of this held for 600ms on purpose.
 *
 * The argument for a hold was that the flight decelerated into its arrival and
 * the dive accelerated out of it, so butting them together put two flat spots
 * back to back. That diagnosis was right and the fix was wrong: separating two
 * dead stops with a pause does not hide them, it announces them. The whole
 * sequence read as arrive — wait — brighten — drop.
 *
 * The actual fix was upstream, in the easing. The flight now coasts in still
 * moving (`easeInCoast`) and the descent picks that speed up rather than
 * building it again from nothing, so there is no flat spot left for a beat to
 * paper over. Left as a knob because it is the obvious thing to reach for if
 * the approach ever wants breathing room again — but reach for it knowing that
 * a pause is a symptom fix.
 */
export const ARRIVAL_HOLD_MS = 0;

/**
 * Reduced motion: same cut, no journey.
 *
 * The transition still has to be *seen* to be understood — jumping instantly
 * from orbit to a surface with no visual connection is more disorienting than
 * a slow move, not less. So the veil stays, just brief, and the camera moves
 * are skipped entirely. The ordering invariant holds here too.
 */
export const REDUCED = {
  DESCENT_MS: 0,
  VEIL_IN_MS: 160,
  SWAP_MS: 220,
  VEIL_OUT_MS: 200,
} as const;

/** The four numbers above, picked by whether the visitor asked for less motion. */
export function cutTiming(reduced: boolean) {
  return reduced
    ? REDUCED
    : { DESCENT_MS, VEIL_IN_MS, SWAP_MS, VEIL_OUT_MS };
}
