// ============================================================================
// THE ONLY FILE YOU EDIT TO ADD A SECTION.
//
// Append one entry to PLANETS below and a fully working planet appears: it
// gets an orbit, a speed, a starting angle, a ring, a nav-ring button and a
// keyboard slot. Nothing here is hardcoded per planet — every spatial value
// is derived from the entry's position in the array, so inserting a planet
// in the middle re-spaces the whole system automatically.
// ============================================================================

/** What you actually author. Everything else is computed. */
export type PlanetDef = {
  /** Stable key. Used for routing, React keys and content lookup. */
  id: string;
  /** Shown on hover and in the nav ring. */
  label: string;
  /** The real solar-system body this section is dressed as. */
  body: string;
  /** Planet body colour. */
  color: string;
  /** Brighter partner colour for labels, rings and atmosphere glow. */
  accent: string;
  /**
   * Radius relative to Earth, straight from the real body. Compressed into
   * scene units below — see SIZE_COMPRESSION.
   */
  radiusRatio: number;
  /** Saturn. Nothing else in this system has one. */
  ring?: boolean;
  /** Optional absolute radius override, bypassing radiusRatio entirely. */
  size?: number;
};

// Each section is dressed as a real planet, in true order out from the sun, so
// the system reads as *the* solar system rather than six coloured balls. That
// ordering is free: orbit radius is derived from array index, so listing them
// Mercury-outward is all it takes.
//
// This deliberately drops the old colour scheme, which carried over from the
// modal themes in GraphNav (About=cyan, Experience=amber, and so on). Real
// bodies are more recognisable than an inherited palette, and recognisability
// is the entire point of the change. The accents are still the UI's colour for
// each section — nav ring, labels, landing veil, surface — so the sections stay
// visually distinct, just under a different set of colours.
export const PLANETS: PlanetDef[] = [
  {
    id: "about",
    label: "About Me",
    body: "Mercury",
    color: "#8a8681",
    accent: "#cfc9c0",
    radiusRatio: 0.38,
  },
  {
    id: "experience",
    label: "Experience",
    body: "Venus",
    color: "#c9a227",
    accent: "#f2dc9b",
    radiusRatio: 0.95,
  },
  {
    id: "education",
    label: "Education",
    body: "Earth",
    color: "#2f6fb5",
    accent: "#6fd3e8",
    radiusRatio: 1,
  },
  {
    id: "projects",
    label: "Projects",
    body: "Mars",
    color: "#b4462a",
    accent: "#e5793f",
    radiusRatio: 0.53,
  },
  {
    id: "resume",
    label: "Resume",
    body: "Jupiter",
    color: "#bf8f5e",
    accent: "#e8c79a",
    radiusRatio: 11.2,
  },
  {
    id: "contact",
    label: "Contact",
    body: "Saturn",
    color: "#c8b273",
    accent: "#f0e3bb",
    radiusRatio: 9.4,
    ring: true,
  },
];

// ---------------------------------------------------------------------------
// Derivation constants — tuning the system means changing these, not the
// entries above.
// ---------------------------------------------------------------------------

/**
 * Empty space required between one body's outer edge and the next one's.
 *
 * Note this is a *clearance*, not an orbit gap — the difference matters now
 * that the bodies are wildly different sizes. A constant gap is only safe if
 * you size it for the largest pair in the system, which then strands the small
 * inner planets miles apart for no reason. Worse, it fails silently: at a
 * constant 4.2 the Jupiter/Saturn pair cleared each other by 0.11 units, so
 * Saturn's rings would have appeared to graze Jupiter every time their orbits
 * lined up, and nothing in the code would have said so.
 *
 * Spacing each orbit off the actual edges below makes the guarantee explicit
 * and lets the inner system stay compact.
 */
const MIN_CLEARANCE = 1.8;
/**
 * Radius of a body the size of Earth. Sized against the solved system-view
 * distance, where this reads as roughly 40px — small enough to feel like a
 * planet, big enough to be an easy target.
 */
const BASE_SIZE = 1.8;
/**
 * How hard true planetary radii are squashed, as an exponent.
 *
 * Jupiter is 11.2 Earths across. At true scale it would be wider than the gap
 * between its neighbours' orbits, and Mercury would be a speck too small to
 * click. Raising the ratio to a fractional power keeps the *ordering* honest —
 * Jupiter is still unmistakably the giant, Mercury still the runt — while
 * compressing a 30x spread into about 2x. Sizes are a legibility decision;
 * only their relative order carries meaning.
 */
const SIZE_COMPRESSION = 0.22;

/**
 * The sun's radius, in Earth radii *as drawn*.
 *
 * The true figure is 109, and even squashed by SIZE_COMPRESSION that lands at
 * 2.81 — big enough that Mercury ends up sitting in the star's glare with
 * nowhere to put it. So this one number is capped by hand rather than derived.
 * It still has to clear Jupiter (3.06 units, the largest planet), which 2.2
 * does comfortably at 3.96; a sun smaller than one of its planets is wrong to
 * anyone, astronomy or not.
 */
const SUN_SIZE_FACTOR = 2.2;

/** Radius of the sun's body. */
export const SUN_RADIUS = BASE_SIZE * SUN_SIZE_FACTOR;

/**
 * The transparent shell Sun.tsx draws as corona, as a multiple of the body.
 * Shared so the orbit walk below spaces Mercury off what is actually *visible*
 * rather than off the solid core.
 */
export const SUN_CORONA_SCALE = 1.22;

/**
 * Clearance between the sun and the innermost orbit — much larger than the
 * clearance between two planets, and not for geometric reasons.
 *
 * The sun is the scene's only real light source and it renders at full
 * brightness through an unlit material. Whatever sits beside it competes with
 * that glare, so geometric separation is not perceptual separation: at a plain
 * MIN_CLEARANCE, Mercury cleared the corona by 3.8% of the system's radius and
 * simply could not be picked out, where sprint 4's arrangement gave it 9.9%.
 * 4.5 restores that ratio.
 *
 * The lesson is the reusable part: spacing rules derived from geometry alone
 * are wrong next to anything that emits light.
 */
const SUN_CLEARANCE = 4.5;
/** Scales all orbital speeds at once. Raise for a livelier system. */
const SPEED_SCALE = 0.9;

/**
 * The golden angle (~137.5°). Spacing start angles by this constant means
 * planets never line up in a row, and — unlike a fixed 360/n split — the
 * distribution stays good no matter how many planets you add later.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** An authored PlanetDef plus everything computed from its index. */
export type Planet = Required<Omit<PlanetDef, "size" | "ring">> & {
  size: number;
  ring: boolean;
  index: number;
  orbitRadius: number;
  orbitSpeed: number;
  startAngle: number;
};

/**
 * Saturn's ring, as multiples of its own radius. Real proportions — the ring
 * system starts well clear of the surface and ends about twice the planet's
 * radius out, which is what makes the silhouette instantly readable.
 */
export const PLANET_RING = { inner: 1.35, outer: 1.9 };

/** How far a body reaches from its own centre, rings included. */
function outerEdge(size: number, ring: boolean): number {
  return ring ? size * PLANET_RING.outer : size;
}

/**
 * Orbits are laid out by walking outward and leaving MIN_CLEARANCE between
 * each body's outer edge and the next one's, rather than stepping by a fixed
 * amount. A running total, so it has to be a loop instead of a map — each
 * radius depends on the one before it.
 *
 * Appending a planet still works with no other edit: it lands outside whatever
 * is currently outermost, spaced for its own size, and SYSTEM_EXTENT and the
 * camera framing follow.
 */
export const PLANET_SYSTEM: Planet[] = [];

// The sun is the first edge to clear, which is what puts the innermost orbit
// outside it automatically instead of relying on a hand-tuned FIRST_ORBIT that
// silently stops being correct the moment the sun or the planets are resized.
//
// Measured to the corona, not the core: the glow is what the innermost planet
// actually has to be seen against.
let previousEdge = SUN_RADIUS * SUN_CORONA_SCALE;
let radius = 0;

PLANETS.forEach((def, index) => {
  // Real relative size, squashed. An explicit `size` still wins outright.
  const size = def.size ?? BASE_SIZE * Math.pow(def.radiusRatio, SIZE_COMPRESSION);
  const ring = def.ring ?? false;
  const edge = outerEdge(size, ring);

  radius += previousEdge + edge + (index === 0 ? SUN_CLEARANCE : MIN_CLEARANCE);
  previousEdge = edge;

  PLANET_SYSTEM.push({
    ...def,
    index,
    ring,
    size,
    orbitRadius: radius,
    // Kepler, loosely: distant planets travel slower. Dividing by sqrt(r) is
    // the real relationship and it happens to look right — without it the
    // outer planets whip around and the system reads as a fairground ride.
    orbitSpeed: SPEED_SCALE / Math.sqrt(radius),
    startAngle: index * GOLDEN_ANGLE,
  });
});

/**
 * How far the system reaches — used to frame the camera and size the
 * starfield.
 *
 * The outermost *orbit* is not the outermost *thing*: Saturn's rings sweep
 * about three units beyond the path its centre follows, so framing to the
 * orbit alone would clip them against the edge of the screen once per lap.
 * Measuring to the outer edge of the last body covers whatever ends up out
 * there, rings or not.
 */
const outermost = PLANET_SYSTEM[PLANET_SYSTEM.length - 1];
export const SYSTEM_EXTENT =
  outermost.orbitRadius + outerEdge(outermost.size, outermost.ring);

export function getPlanet(id: string): Planet | undefined {
  return PLANET_SYSTEM.find((p) => p.id === id);
}
