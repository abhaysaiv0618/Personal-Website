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
 * swap interrupts it at SWAP_MS — which is exactly why the descent uses an
 * ease-*in* rather than the flight's ease-in-out. The viewer only ever sees
 * the accelerating half, so the motion reads as falling rather than as a
 * camera move that politely slows down.
 *
 * The gap to SWAP_MS is therefore not slack, it is a framing decision. The
 * dive runs from the hover position (7 planet radii out) to just above the
 * surface, on a quadratic ease. Cutting at 1150/1400 = 0.82 of the way through
 * puts the camera about 3 radii from the centre, where the planet subtends
 * roughly 37 degrees against a 50 degree lens — most of the frame, which is
 * what the cut needs in order to have something to hide behind. Widen this gap
 * and you cut away while the planet is still small and distant; close it and
 * the camera is inside the planet when the veil lands.
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
 * Landing follows a flight automatically — one click takes you from the system
 * view to standing on a surface — but not *instantly*. Cutting straight from
 * the flight's deceleration into the dive's acceleration reads as one
 * continuous lurch with a kink in the middle. A short hold separates them into
 * two moves: you arrive, the planet hangs there for a moment, then you drop.
 *
 * Short enough that nobody experiences it as waiting, long enough that the
 * arrival registers as its own event.
 */
export const ARRIVAL_HOLD_MS = 600;

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
