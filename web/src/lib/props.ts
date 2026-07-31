import type { Planet, PropKind } from "./planets";
import { type SectionItem, sectionItems } from "./content";
import { CLEARING_RADIUS, hashId, mulberry32 } from "./surface";

/**
 * Where a section's content stands on its world.
 *
 * Nothing here is authored per planet. The *kind* comes from the entry in
 * lib/planets.ts, the *count* comes from the content in lib/content.ts, and the
 * arrangement below is derived from a hash of the id — the same seed the rock
 * field uses, so the two agree about which world this is. Append a section and
 * it gets a laid-out surface with no edit to this file.
 *
 * "Derived" carries the same weight it does for the rocks: the layout must be
 * identical on every visit. A recruiter who sends someone a link and a person
 * who reloads the tab have to be looking at the same place.
 */

/** How big each kind of object is. Shared with the component that draws it. */
export const PROP_DIMENSIONS: Record<
  PropKind,
  { width: number; height: number; depth: number }
> = {
  /** A standing slab. One per role, so they read as a row of markers. */
  monolith: { width: 1.15, height: 3.4, depth: 0.42 },
  /** A shipping crate. Squat, and there are five of them. */
  crate: { width: 1.5, height: 1.5, depth: 1.5 },
  /** A single tall obelisk. There is only ever one. */
  monument: { width: 1.5, height: 4.4, depth: 1.5 },
  /** A console on legs, angled toward you. */
  terminal: { width: 1.7, height: 1.6, depth: 0.9 },
  /** A thin mast with a light on top. The fallback shape. */
  beacon: { width: 0.55, height: 2.9, depth: 0.55 },
};

/**
 * The arc the props stand on, in degrees, measured from straight ahead.
 * Negative is to your left.
 *
 * SurfaceControls stands you facing −Z with yaw and pitch at zero, so "straight
 * ahead" is a real, fixed direction rather than wherever the last camera move
 * happened to end.
 *
 * The whole arc is to the **left** because the rocket parks to the right —
 * rocketPlacement puts it up to 16° right of centre at about 5.6 units out, so
 * it occupies roughly 9° to 23° of your view. Its exact angle depends on the
 * viewport aspect and the props' does not, so the only robust way to keep a
 * phone from stacking a monolith on top of the rocket is to put them on
 * opposite sides of the view and never let the arcs meet.
 */
const RIGHT_EDGE_DEG = -6;
const ARC_SPAN_DEG = 72;
/** Where a lone object goes: near centre, still clear of the rocket. */
const SINGLE_DEG = -18;

/**
 * How far out the arc sits.
 *
 * Bounded above by CLEARING_RADIUS — rocks start outside that and know nothing
 * about the props, so anything placed beyond it can and eventually will grow
 * out of a boulder. Bounded below by "far enough to see the whole thing at eye
 * height without backing up", which a 4.4-unit monument needs about 8 units for.
 */
const PROP_RADIUS = 10.2;
/**
 * Every other object is pushed this much further out.
 *
 * Without it a row of evenly spaced props on a constant radius reads as a
 * fence — the one arrangement that makes a place look authored rather than
 * found. Staggering the depth also buys real separation between neighbours on
 * the worlds with five of them, where the angular step alone is tight.
 */
const STAGGER = 2.1;

export type PlacedProp = SectionItem & {
  position: [number, number, number];
  /** Turned to face the landing site, plus a little jitter. */
  rotationY: number;
};

/**
 * Lay out one world's objects.
 *
 * y is 0 for everything: props stand *on* the ground, unlike the rocks, which
 * are deliberately sunk below it so they read as terrain rather than as
 * scenery placed on a floor. The distinction is the point — these are the
 * objects you are meant to walk up to.
 */
export function propLayout(planet: Planet): PlacedProp[] {
  const items = sectionItems(planet.id);
  if (items.length === 0) return [];

  // Offset the seed from the rock field's so a world's props and its boulders
  // don't share a draw sequence and end up correlated.
  const random = mulberry32(hashId(`${planet.id}:props`));
  const count = items.length;

  return items.map((item, i) => {
    const degrees =
      count === 1
        ? SINGLE_DEG
        : RIGHT_EDGE_DEG - (i * ARC_SPAN_DEG) / (count - 1);

    // Jitter is small on purpose. Enough that the row isn't machined, not
    // enough to reorder anything or push a prop out of the clearing.
    const azimuth = ((degrees + (random() - 0.5) * 5) * Math.PI) / 180;
    const radius =
      PROP_RADIUS + (i % 2 === 1 ? STAGGER : 0) + (random() - 0.5) * 0.9;

    return {
      ...item,
      position: [
        Math.sin(azimuth) * radius,
        0,
        // −Z is forward, matching rocketPlacement's convention.
        -Math.cos(azimuth) * radius,
      ],
      // Facing the landing site works out to exactly −azimuth: a prop at
      // azimuth θ sits along (sinθ, −cosθ), and turning its local +Z back
      // toward the origin is atan2(−sinθ, cosθ) = −θ. Jittered a few degrees so
      // they aren't all squared up to the same point.
      rotationY: -azimuth + (random() - 0.5) * 0.3,
    };
  });
}

/** Sanity: the arc has to stay inside the clearing, or rocks grow through it. */
export const PROP_OUTER_REACH = PROP_RADIUS + STAGGER + 0.45;
if (PROP_OUTER_REACH > CLEARING_RADIUS) {
  // Not thrown — a layout that overlaps some boulders is ugly, not broken, and
  // failing a page load over it would be worse. But it should be loud in dev.
  console.warn(
    `[props] arc reaches ${PROP_OUTER_REACH.toFixed(1)} but rocks start at ` +
      `${CLEARING_RADIUS}. Raise CLEARING_RADIUS in lib/surface.ts.`
  );
}
